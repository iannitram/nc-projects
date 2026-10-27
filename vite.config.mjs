import { createAppConfig } from '@nextcloud/vite-config'

// Builds src/main.js into js/cc_projects-main.mjs and one stylesheet, css/cc_projects-style.css.
// templates/main.php loads them with script() and style(); the names follow vite-config's
// `<appName>-` prefix convention.
export default createAppConfig({
	main: 'src/main.js',
}, {
	inlineCSS: false,
	extractLicenseInformation: false,
	thirdPartyLicense: false,
	config: {
		build: {
			cssCodeSplit: false,
		},
	},
})
