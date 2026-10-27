/**
 * One VTODO, wrapped with `ical.js` (P03; CODE_MAP rules 1 and 2).
 * Keeps every property and parameter it does not edit, byte for byte where possible.
 * Stub: signatures only.
 */
import ICAL from 'ical.js'

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
		return this.changed ? this.component.toString() : this.ics
	}

	get uid() { return this.propertyValue('uid') }
	get summary() { return this.propertyValue('summary') }
	set summary(value) { this.setValue('summary', value) }
	get status() { return this.propertyValue('status') }
	get completed() { return this.vtodo.hasProperty('completed') }
	set completed(value) {
		if (value) {
			this.setValue('status', 'COMPLETED')
			this.setValue('completed', utcTime(new Date()))
			this.setValue('percent-complete', 100)
		} else {
			this.setValue('status', 'NEEDS-ACTION')
			this.removeProperties('completed', 'percent-complete')
		}
		this.touch()
	}

	get closed() { return this.completed || this.status === 'CANCELLED' }
	get due() { return this.propertyValue('due') }
	set due(value) {
		if (value === null) {
			this.removeProperties('due')
		} else {
			this.setValue('due', value instanceof Date ? utcTime(value) : value)
		}
		this.touch()
	}

	get priority() {
		const value = this.propertyValue('priority')
		return value === null ? null : Number(value)
	}

	set priority(value) {
		if (value === 0 || value === null) {
			this.removeProperties('priority')
		} else {
			this.setValue('priority', value)
		}
		this.touch()
	}

	get categories() {
		return this.vtodo.getAllProperties('categories').flatMap((property) => property.getValues())
	}

	set categories(values) {
		this.removeProperties('categories')
		if (values?.length) {
			const property = new ICAL.Property('categories')
			property.setValues(values)
			this.vtodo.addProperty(property)
		}
		this.touch()
	}

	get isProject() { return this.categories.includes('project') }
	get parentUid() {
		const property = this.parentProperty()
		return property ? property.getFirstValue() : null
	}

	set parentUid(value) {
		const parent = this.parentProperty()
		if (parent) {
			this.vtodo.removeProperty(parent)
		}
		if (value !== null) {
			this.vtodo.addPropertyWithValue('related-to', value)
		}
		this.touch()
	}

	get sortOrder() {
		const value = this.propertyValue('x-apple-sort-order')
		return value === null ? null : Number(value)
	}

	set sortOrder(value) {
		if (value === null) {
			this.removeProperties('x-apple-sort-order')
		} else {
			this.setValue('x-apple-sort-order', value)
		}
		this.touch()
	}

	get created() { return this.propertyValue('created') }
	get url() { return this.where.url }
	get etag() { return this.where.etag }
	get calendarUrl() { return this.where.calendarUrl }

	propertyValue(name) { return this.vtodo.getFirstPropertyValue(name) }

	setValue(name, value) {
		this.removeProperties(name)
		this.vtodo.addPropertyWithValue(name, value)
		this.touch()
	}

	removeProperties(...names) {
		for (const name of names) {
			for (const property of this.vtodo.getAllProperties(name)) {
				this.vtodo.removeProperty(property)
			}
		}
	}

	touch() {
		const now = utcTime(new Date())
		this.removeProperties('last-modified', 'dtstamp')
		this.vtodo.addPropertyWithValue('last-modified', now)
		this.vtodo.addPropertyWithValue('dtstamp', now)
		this.changed = true
	}

	parentProperty() {
		return this.vtodo.getAllProperties('related-to').find((property) => {
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
