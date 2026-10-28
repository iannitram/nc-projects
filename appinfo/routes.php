<?php
declare(strict_types=1);

return [
	'routes' => [
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
		['name' => 'settings#getAreas', 'url' => '/api/settings/areas', 'verb' => 'GET'],
		['name' => 'settings#setAreas', 'url' => '/api/settings/areas', 'verb' => 'PUT'],
	],
];
