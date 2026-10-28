<?php

declare(strict_types=1);

namespace OCA\CcProjects\Controller;

use OCA\CcProjects\AppInfo\Application;
use OCP\App\IAppManager;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\AppFramework\Services\IInitialState;
use OCP\IAppConfig;
use OCP\IConfig; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\IRequest;
use OCP\ServerVersion;
use Psr\Log\LoggerInterface; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use Psr\Log\NullLogger; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

class PageController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IInitialState $initialState,
		private readonly IAppManager $appManager,
		private readonly IAppConfig $appConfig,
		private readonly ServerVersion $serverVersion,
		private readonly IConfig $config, // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		private readonly LoggerInterface $logger = new NullLogger(), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		try { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$metadataFile = __DIR__ . '/../../appinfo/build.json';
			$metadata = is_file($metadataFile) ? json_decode(file_get_contents($metadataFile), true) : [];
			$this->initialState->provideInitialState('bugReport', [
				'version' => $this->appManager->getAppVersion(Application::APP_ID),
				'commit' => $metadata['commit'] ?? 'unknown',
				'ncVersion' => $this->serverVersion->getVersionString(),
				'configured' => $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_base') !== ''
					&& $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_token') !== '',
			]);
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
