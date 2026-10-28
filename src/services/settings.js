import { getRequestToken } from '@nextcloud/auth'
import { generateUrl } from '@nextcloud/router'

const SETTINGS_URL = () => generateUrl('/apps/cc_projects/api/settings/areas')

async function request(method, body) {
	const response = await fetch(SETTINGS_URL(), {
		method,
		headers: {
			requesttoken: getRequestToken(),
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	})
	if (!response.ok) {
		throw new Error(`Could not ${method === 'GET' ? 'load' : 'save'} area settings (${response.status})`)
	}
	return response.json()
}

export async function getAreaLists() {
	const result = await request('GET')
	return result.areaLists
}

export async function saveAreaLists(urls) {
	const result = await request('PUT', { areaLists: urls })
	return result.areaLists
}
