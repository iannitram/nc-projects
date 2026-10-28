<?php

declare(strict_types=1);

namespace OCA\CcProjects\Controller;

use OCA\CcProjects\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;
use Psr\Log\LoggerInterface; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use Psr\Log\NullLogger; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

class SettingsController extends Controller {
	public const MAX_AREA_LISTS = 100;
	public const MAX_URL_LENGTH = 1024;

	public function __construct(IRequest $request, private IConfig $config, private ?string $userId, private LoggerInterface $logger = new NullLogger()) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * @NoAdminRequired
	 */
	public function getAreas(): JSONResponse {
		try { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			if ($this->userId === null) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				return new JSONResponse(['message' => 'Authentication required'], 401); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

			$decoded = json_decode($this->config->getUserValue($this->userId, Application::APP_ID, 'area_lists', '[]'), true); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$areaLists = is_array($decoded) && array_is_list($decoded) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				&& count(array_filter($decoded, static fn ($value): bool => is_string($value))) === count($decoded) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				? array_values($decoded) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				: []; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			return new JSONResponse(['areaLists' => $areaLists]); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		} catch (\Throwable $e) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			ClientLogController::reportServerException($this->logger, __METHOD__, $e); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			throw $e; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

	/**
	 * @NoAdminRequired
	 */
	public function setAreas($areaLists = []): JSONResponse {
		try { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			if ($this->userId === null) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				return new JSONResponse(['message' => 'Authentication required'], 401); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			if (!is_array($areaLists) || !array_is_list($areaLists) || count($areaLists) > self::MAX_AREA_LISTS) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				return new JSONResponse(['message' => 'Area lists must be a list of at most 100 URLs'], 400); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			foreach ($areaLists as $url) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				if (!is_string($url) || trim($url) === '' || strlen($url) > self::MAX_URL_LENGTH) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
					return new JSONResponse(['message' => 'Area list URLs must be non-empty strings'], 400); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
				} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$areaLists = array_values(array_unique($areaLists)); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$this->config->setUserValue($this->userId, Application::APP_ID, 'area_lists', json_encode($areaLists)); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			return new JSONResponse(['areaLists' => $areaLists]); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		} catch (\Throwable $e) { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			ClientLogController::reportServerException($this->logger, __METHOD__, $e); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			throw $e; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
