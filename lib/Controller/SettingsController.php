<?php

declare(strict_types=1);

namespace OCA\CcProjects\Controller;

use OCA\CcProjects\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;

class SettingsController extends Controller {
	public const MAX_AREA_LISTS = 100;
	public const MAX_URL_LENGTH = 1024;

	public function __construct(IRequest $request, private IConfig $config, private ?string $userId) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * @NoAdminRequired
	 */
	public function getAreas(): JSONResponse {
		if ($this->userId === null) {
			return new JSONResponse(['message' => 'Authentication required'], 401);
		}

		$decoded = json_decode($this->config->getUserValue($this->userId, Application::APP_ID, 'area_lists', '[]'), true);
		$areaLists = is_array($decoded) && array_is_list($decoded)
			&& count(array_filter($decoded, static fn ($value): bool => is_string($value))) === count($decoded)
			? array_values($decoded)
			: [];
		return new JSONResponse(['areaLists' => $areaLists]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function setAreas($areaLists = []): JSONResponse {
		if ($this->userId === null) {
			return new JSONResponse(['message' => 'Authentication required'], 401);
		}
		if (!is_array($areaLists) || !array_is_list($areaLists) || count($areaLists) > self::MAX_AREA_LISTS) {
			return new JSONResponse(['message' => 'Area lists must be a list of at most 100 URLs'], 400);
		}
		foreach ($areaLists as $url) {
			if (!is_string($url) || trim($url) === '' || strlen($url) > self::MAX_URL_LENGTH) {
				return new JSONResponse(['message' => 'Area list URLs must be non-empty strings'], 400);
			}
		}
		$areaLists = array_values(array_unique($areaLists));
		$this->config->setUserValue($this->userId, Application::APP_ID, 'area_lists', json_encode($areaLists));
		return new JSONResponse(['areaLists' => $areaLists]);
	}
}
