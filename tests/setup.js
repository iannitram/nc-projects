// jsdom lacks ResizeObserver, which @nextcloud/vue's popovers use.
if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

// Nextcloud server provides #skip-actions in its page template for NcContent skip links.
if (typeof document !== 'undefined' && !document.getElementById('skip-actions')) {
	const skipActions = document.createElement('div')
	skipActions.id = 'skip-actions'
	document.body.appendChild(skipActions)
}
