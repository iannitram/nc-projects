<?php

declare(strict_types=1);

namespace OCA\CcProjects\Controller;

use OCA\CcProjects\AppInfo\Application;
use OCP\App\IAppManager; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IAppConfig; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\IConfig; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\IRequest;
use Psr\Log\LoggerInterface; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use Psr\Log\NullLogger; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

class PageController extends Controller {
	public function __construct( // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		IRequest $request, // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		private readonly IAppConfig $appConfig, // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		private readonly IAppManager $appManager, // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		private readonly IConfig $config, // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		private readonly LoggerInterface $logger = new NullLogger(), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Renders the app page: the mount point and the built Vue script. No data API: the browser talks CalDAV (ADR 0002).
	 *
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	public function index(): TemplateResponse {
		try { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			return new TemplateResponse(Application::APP_ID, 'main', [ // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				'crashLog' => $this->appConfig->getValueString(Application::APP_ID, 'crash_log', '1'), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				'appVersion' => $this->appManager->getAppVersion(Application::APP_ID), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				'ncVersion' => $this->config->getSystemValueString('version', ''), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			]); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		} catch (\Throwable $e) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			ClientLogController::reportServerException($this->logger, __METHOD__, $e); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			throw $e; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	}
}
