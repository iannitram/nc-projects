<?php

declare(strict_types=1);

namespace OCA\CcProjects\Tests;

use OCA\CcProjects\Controller\SettingsController;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;

final class SettingsControllerTest extends TestCase {
	private function controller(IConfig $config, ?string $userId = 'user-a'): SettingsController {
		return new SettingsController($this->createMock(IRequest::class), $config, $userId);
	}

	public function testDefaultIsEmpty(): void {
		$config = $this->createMock(IConfig::class);
		$config->expects($this->once())->method('getUserValue')->with('user-a', 'cc_projects', 'area_lists', '[]')->willReturn('[]');
		$response = $this->controller($config)->getAreas();
		$this->assertInstanceOf(JSONResponse::class, $response);
		$this->assertSame(['areaLists' => []], $response->getData());
	}

	public function testRoundTripStoresForCurrentUserAndDeduplicatesInOrder(): void {
		$config = $this->createMock(IConfig::class);
		$config->expects($this->once())->method('setUserValue')->with('user-a', 'cc_projects', 'area_lists', '["\/list-a\/","\/list-b\/"]');
		$response = $this->controller($config)->setAreas(['/list-a/', '/list-b/', '/list-a/']);
		$this->assertSame(['areaLists' => ['/list-a/', '/list-b/']], $response->getData());
	}

	public function testGetUsesConstructorUserId(): void {
		$config = $this->createMock(IConfig::class);
		$config->expects($this->once())->method('getUserValue')->with('user-b', 'cc_projects', 'area_lists', '[]')->willReturn('["/list-a/"]');
		$response = $this->controller($config, 'user-b')->getAreas();
		$this->assertSame(['areaLists' => ['/list-a/']], $response->getData());
	}

	public function testInvalidValuesAreRejected(): void {
		$config = $this->createMock(IConfig::class);
		$config->expects($this->never())->method('setUserValue');
		$response = $this->controller($config)->setAreas(['/list-a/', '']);
		$this->assertSame(400, $response->getStatus());
		$this->assertArrayHasKey('message', $response->getData());
	}

	public function testNullUserIsUnauthorized(): void {
		$config = $this->createMock(IConfig::class);
		$config->expects($this->never())->method('getUserValue');
		$config->expects($this->never())->method('setUserValue');
		$this->assertSame(401, $this->controller($config, null)->getAreas()->getStatus());
		$this->assertSame(401, $this->controller($config, null)->setAreas([])->getStatus());
	}

	public function testInvalidAreaListShapesAndSizesAreRejected(): void {
		foreach (['x', ['a' => 'b'], 5, null, ['/a/', 5], ['   '], array_fill(0, 101, '/a/'), [str_repeat('a', 1025)]] as $areaLists) {
			$config = $this->createMock(IConfig::class);
			$config->expects($this->never())->method('setUserValue');
			$response = $this->controller($config)->setAreas($areaLists);
			$this->assertSame(400, $response->getStatus());
			$this->assertArrayHasKey('message', $response->getData());
		}
	}

	public function testMaximumAreaListSizeAndUrlLengthAreAccepted(): void {
		$areaLists = array_map(static fn (int $index): string => str_pad((string)$index, 1024, 'a'), range(0, 99));
		$config = $this->createMock(IConfig::class);
		$config->expects($this->once())->method('setUserValue')->with('user-a', 'cc_projects', 'area_lists', json_encode($areaLists));
		$response = $this->controller($config)->setAreas($areaLists);
		$this->assertSame(200, $response->getStatus());
		$this->assertSame(['areaLists' => $areaLists], $response->getData());
	}
}
