<?php

declare(strict_types=1);

namespace OCA\CcProjects\AppInfo;

use OCP\AppFramework\App;

class Application extends App {
	public const APP_ID = 'cc_projects';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}
}
