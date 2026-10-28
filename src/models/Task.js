/**
 * One VTODO, wrapped with `ical.js` (P03; CODE_MAP rules 1 and 2).
 * Keeps every property and parameter it does not edit, byte for byte where possible.
 * Stub: signatures only.
 */
import ICAL from 'ical.js'
import { toRaw } from 'vue'

export class Task {
	constructor(component, vtodo, ics, where) {
		this.component = component
		this.vtodo = vtodo
		this.ics = ics
		this.changed = false
		this.where = where
	}

	/**
	 * @param {string} ics raw iCalendar text
	 * @param {object} where where it is stored
	 * @param {string} where.url the task's URL ('' before it is created)
	 * @param {string} where.etag its etag ('' before it is created)
	 * @param {string} where.calendarUrl the list it lives on
	 * @return {Task}
	 */
	static fromIcs(ics, where) {
		const component = ICAL.Component.fromString(ics)
		const vtodo = component.name === 'vtodo'
			? component
			: component.getFirstSubcomponent('vtodo')

		if (!vtodo) {
			throw new TypeError('Task.fromIcs requires a VTODO')
		}

		return new Task(component, vtodo, ics, where)
	}

	/**
	 * A new open task, shaped like Tasks creates them (random UID, CREATED, DTSTAMP).
	 *
	 * @param {object} fields the new task's fields
	 * @param {string} fields.summary title
	 * @param {string} fields.calendarUrl the list it will live on
	 * @param {string} [fields.parentUid] bare RELATED-TO target
	 * @param {string[]} [fields.categories] e.g. ['project']
	 * @return {Task}
	 */
	static create(fields) {
		const now = new Date()
		const component = new ICAL.Component('vcalendar')
		component.addPropertyWithValue('prodid', '-//cc_projects//Projects//EN')
		component.addPropertyWithValue('version', '2.0')
		const vtodo = component.addSubcomponent(new ICAL.Component('vtodo'))
		vtodo.addPropertyWithValue('uid', crypto.randomUUID())
		vtodo.addPropertyWithValue('created', utcTime(now))
		vtodo.addPropertyWithValue('dtstamp', utcTime(now))
		vtodo.addPropertyWithValue('last-modified', utcTime(now))
		vtodo.addPropertyWithValue('summary', fields.summary)
		vtodo.addPropertyWithValue('status', 'NEEDS-ACTION')
		const task = new Task(component, vtodo, '', {
			url: '',
			etag: '',
			calendarUrl: fields.calendarUrl,
		})
		if (fields.parentUid !== undefined && fields.parentUid !== null) {
			task.parentUid = fields.parentUid
		}
		if (fields.categories !== undefined && fields.categories !== null) {
			task.categories = fields.categories
		}
		task.changed = true
		return task
	}

	/**
	 * Serialize, keeping everything this class did not change.
	 *
	 * @return {string}
	 */
	toIcs() {
		const self = toRaw(this)
		return self.changed ? self.component.toString() : self.ics
	}

	get uid() { return this.propertyValue('uid') }
	get summary() { return this.propertyValue('summary') }
	set summary(value) {
		const self = toRaw(this)
		self.setValue('summary', value)
	}

	get status() { return this.propertyValue('status') }
	get completed() {
		const self = toRaw(this)
		return self.vtodo.hasProperty('completed')
	}

	set completed(value) {
		const self = toRaw(this)
		if (value) {
			self.setValue('status', 'COMPLETED')
			self.setValue('completed', utcTime(new Date()))
			self.setValue('percent-complete', 100)
		} else {
			self.setValue('status', 'NEEDS-ACTION')
			self.removeProperties('completed', 'percent-complete')
		}
		self.touch()
	}

	get closed() {
		const self = toRaw(this)
		return self.completed || self.status === 'CANCELLED'
	}

	get due() { return this.propertyValue('due') }
	set due(value) {
		const self = toRaw(this)
		if (value === null) {
			self.removeProperties('due')
		} else {
			self.setValue('due', value instanceof Date ? utcTime(value) : value)
		}
		self.touch()
	}

	get priority() {
		const value = this.propertyValue('priority')
		return value === null ? null : Number(value)
	}

	set priority(value) {
		const self = toRaw(this)
		if (value === 0 || value === null) {
			self.removeProperties('priority')
		} else {
			self.setValue('priority', value)
		}
		self.touch()
	}

	get categories() {
		const self = toRaw(this)
		return self.vtodo.getAllProperties('categories').flatMap((property) => property.getValues())
	}

	set categories(values) {
		const self = toRaw(this)
		self.removeProperties('categories')
		if (values?.length) {
			const property = new ICAL.Property('categories')
			property.setValues(values)
			self.vtodo.addProperty(property)
		}
		self.touch()
	}

	get isProject() {
		const self = toRaw(this)
		return self.categories.includes('project')
	}

	get parentUid() {
		const self = toRaw(this)
		const property = self.parentProperty()
		return property ? property.getFirstValue() : null
	}

	set parentUid(value) {
		const self = toRaw(this)
		const parent = self.parentProperty()
		if (parent) {
			self.vtodo.removeProperty(parent)
		}
		if (value !== null) {
			self.vtodo.addPropertyWithValue('related-to', value)
		}
		self.touch()
	}

	get sortOrder() {
		const value = this.propertyValue('x-apple-sort-order')
		return value === null ? null : Number(value)
	}

	set sortOrder(value) {
		const self = toRaw(this)
		if (value === null) {
			self.removeProperties('x-apple-sort-order')
		} else {
			self.setValue('x-apple-sort-order', value)
		}
		self.touch()
	}

	get created() { return this.propertyValue('created') }
	get url() {
		const self = toRaw(this)
		return self.where.url
	}

	get etag() {
		const self = toRaw(this)
		return self.where.etag
	}

	get calendarUrl() {
		const self = toRaw(this)
		return self.where.calendarUrl
	}

	propertyValue(name) {
		const self = toRaw(this)
		return self.vtodo.getFirstPropertyValue(name)
	}

	setValue(name, value) {
		const self = toRaw(this)
		self.removeProperties(name)
		self.vtodo.addPropertyWithValue(name, value)
		self.touch()
	}

	removeProperties(...names) {
		const self = toRaw(this)
		for (const name of names) {
			for (const property of self.vtodo.getAllProperties(name)) {
				self.vtodo.removeProperty(property)
			}
		}
	}

	touch() {
		const self = toRaw(this)
		const now = utcTime(new Date())
		self.removeProperties('last-modified', 'dtstamp')
		self.vtodo.addPropertyWithValue('last-modified', now)
		self.vtodo.addPropertyWithValue('dtstamp', now)
		self.changed = true
	}

	parentProperty() {
		const self = toRaw(this)
		return self.vtodo.getAllProperties('related-to').find((property) => {
			const reltype = property.getFirstParameter('reltype')
			return reltype === undefined || reltype.toUpperCase() === 'PARENT'
		})
	}
}

/**
 *
 * @param {Date} date the date to represent as UTC
 */
function utcTime(date) {
	const time = ICAL.Time.fromJSDate(date, true)
	time.zone = ICAL.Timezone.utcTimezone
	return time
}

// Fields P03 adds as getters: uid, summary, status, completed, closed, due, priority,
// categories, isProject, parentUid, sortOrder, created, url, etag, calendarUrl.
