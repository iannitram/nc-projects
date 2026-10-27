/**
 * One VTODO, wrapped with `ical.js` (P03; CODE_MAP rules 1 and 2).
 * Keeps every property and parameter it does not edit, byte for byte where possible.
 * Stub: signatures only.
 */
import ICAL from 'ical.js'
import { notImplemented } from '../notImplemented.js'

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
		return notImplemented('Task.create', fields)
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
	set summary(value) { this.setProperty('summary', value) }
	get status() { return this.propertyValue('status') }
	get completed() { return this.vtodo.hasProperty('completed') }
	set completed(value) {
		if (value) {
			this.setProperty('status', 'COMPLETED')
			this.setProperty('completed', ICAL.Time.now())
			this.setProperty('percent-complete', 100)
		} else {
			this.removeProperties('completed')
			this.removeProperties('percent-complete')
			this.setProperty('status', 'NEEDS-ACTION')
		}
	}

	get closed() { return this.completed || this.status === 'CANCELLED' }
	get due() { return this.propertyValue('due') }
	set due(value) {
		if (value === null || value === undefined || value === '') {
			this.removeProperties('due')
			return
		}
		this.setProperty('due', typeof value === 'string' ? ICAL.Time.fromString(value) : value)
	}

	get priority() {
		const value = this.propertyValue('priority')
		return value === null ? null : Number(value)
	}

	set priority(value) {
		if (value === null || value === undefined || value === '') {
			this.removeProperties('priority')
			return
		}
		this.setProperty('priority', Number(value))
	}

	get categories() {
		return this.vtodo.getAllProperties('categories').flatMap((property) => property.getValues())
	}

	set categories(values) {
		const properties = this.vtodo.getAllProperties('categories')
		if (!values || values.length === 0) {
			this.removeProperties('categories')
			return
		}
		if (properties.length > 0) {
			properties[0].setValues(values)
			for (const property of properties.slice(1)) {
				this.vtodo.removeProperty(property)
			}
		} else {
			const property = this.vtodo.addPropertyWithValue('categories', values[0])
			property.setValues(values)
		}
		this.changed = true
	}

	get isProject() { return this.categories.includes('project') }
	get parentUid() {
		const property = this.parentProperty()
		return property ? property.getFirstValue() : null
	}

	set parentUid(value) {
		const property = this.parentProperty()
		if (value === null || value === undefined || value === '') {
			if (property) {
				this.vtodo.removeProperty(property)
				this.changed = true
			}
			return
		}
		if (property) {
			property.setValue(value)
			property.removeParameter('reltype')
		} else {
			this.vtodo.addPropertyWithValue('related-to', value)
		}
		this.changed = true
	}

	get sortOrder() {
		const value = this.propertyValue('x-apple-sort-order')
		return value === null ? null : Number(value)
	}

	set sortOrder(value) {
		if (value === null || value === undefined || value === '') {
			this.removeProperties('x-apple-sort-order')
			return
		}
		this.setProperty('x-apple-sort-order', Number(value))
	}

	get created() { return this.propertyValue('created') }
	get url() { return this.where.url }
	get etag() { return this.where.etag }
	get calendarUrl() { return this.where.calendarUrl }

	propertyValue(name) { return this.vtodo.getFirstPropertyValue(name) }
	setProperty(name, value) {
		this.vtodo.updatePropertyWithValue(name, value)
		this.changed = true
	}

	removeProperties(name) {
		if (this.vtodo.hasProperty(name)) {
			this.vtodo.removeAllProperties(name)
			this.changed = true
		}
	}

	parentProperty() {
		return this.vtodo.getAllProperties('related-to').find((property) => {
			const reltype = property.getFirstParameter('reltype')
			return reltype === undefined || reltype.toUpperCase() === 'PARENT'
		})
	}
}

// Fields P03 adds as getters (and setters where marked): uid, summary (set), status,
// completed (set: true writes STATUS:COMPLETED + COMPLETED + PERCENT-COMPLETE:100; false clears them),
// closed (completed or CANCELLED), due (set), priority (set), categories (set), isProject,
// parentUid (set; bare RELATED-TO), sortOrder (set; X-APPLE-SORT-ORDER, null when absent),
// created, url, etag, calendarUrl.
