<?php

declare(strict_types=1);

namespace OCA\CcProjects\Controller;

use OCA\CcProjects\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;

class PageController extends Controller {
	public function __construct(IRequest $request) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Renders the app page: the mount point and the built Vue script. No data API: the browser talks CalDAV (ADR 0002).
	 *
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	public function index(): TemplateResponse {
		return new TemplateResponse(Application::APP_ID, 'main');
	}
}
