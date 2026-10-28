<?php

declare(strict_types=1);

namespace OCA\CcProjects\Tests;

use OCA\CcProjects\Controller\PageController;
use OCP\App\IAppManager; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IAppConfig; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\IConfig; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\IRequest;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

final class PageControllerTest extends TestCase {
	public function testIndexReturnsTheMainTemplate(): void {
		$controller = new PageController( // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$this->createMock(IRequest::class), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$this->createMock(IAppConfig::class), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$this->createMock(IAppManager::class), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			$this->createMock(IConfig::class), // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

		$response = $controller->index();

		$this->assertInstanceOf(TemplateResponse::class, $response);
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame('cc_projects', $response->getApp());
	}

	// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	public function testIndexPassesTheCrashLogSwitchAndTheVersionsToThePage(): void { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appConfig = $this->createMock(IAppConfig::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appConfig->expects($this->once())->method('getValueString')->with('cc_projects', 'crash_log', '1')->willReturn('0'); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appManager = $this->createMock(IAppManager::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appManager->method('getAppVersion')->willReturn('0.1.0'); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$config = $this->createMock(IConfig::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$config->method('getSystemValueString')->with('version', '')->willReturn('33.0.10.1'); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$controller = new PageController($this->createMock(IRequest::class), $appConfig, $appManager, $config); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

		$response = $controller->index(); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

		$this->assertSame(['crashLog' => '0', 'appVersion' => '0.1.0', 'ncVersion' => '33.0.10.1'], $response->getParams()); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

	// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	public function testIndexLogsAnExceptionAndRethrowsIt(): void { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appConfig = $this->createMock(IAppConfig::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appConfig->method('getValueString')->willThrowException(new \RuntimeException('row "CANARY_PROJECT_TITLE_7f3a" missing')); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$logger = $this->createMock(LoggerInterface::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$logger->expects($this->once())->method('error') // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
			->with($this->stringContains('server exception in OCA\CcProjects\Controller\PageController::index: RuntimeException: row … missing'), ['app' => 'cc_projects']); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$controller = new PageController($this->createMock(IRequest::class), $appConfig, $this->createMock(IAppManager::class), $this->createMock(IConfig::class), $logger); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

		$this->expectException(\RuntimeException::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$controller->index(); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
}
