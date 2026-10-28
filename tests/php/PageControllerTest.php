<?php

declare(strict_types=1);

namespace OCA\CcProjects\Tests;

use OCA\CcProjects\Controller\PageController;
use OCP\App\IAppManager;
use OCP\AppFramework\Services\IInitialState;
use OCP\IAppConfig;
use OCP\IConfig; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
use OCP\IRequest;
use OCP\ServerVersion;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface; // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

final class PageControllerTest extends TestCase {
	public function testInitialStateContainsMetadataAndReadinessOnly(): void {
		$state = $this->createMock(IInitialState::class);
		$apps = $this->createMock(IAppManager::class);
		$apps->method('getAppVersion')->with('cc_projects')->willReturn('0.1.0');
		$config = $this->createMock(IAppConfig::class);
		$config->method('getValueString')->willReturnCallback(fn ($app, $key) => $key === 'bug_drop_base' ? 'https://drop.example.invalid' : 'TEST-TOKEN-123');
		$version = $this->createMock(ServerVersion::class);
		$version->method('getVersionString')->willReturn('33.0.10');
		$state->expects($this->once())->method('provideInitialState')->with('bugReport', $this->callback(function ($data): bool {
			$this->assertSame(['version', 'commit', 'ncVersion', 'configured'], array_keys($data));
			$this->assertSame('0.1.0', $data['version']);
			$this->assertSame('33.0.10', $data['ncVersion']);
			$this->assertTrue($data['configured']);
			$this->assertStringNotContainsString('TEST-TOKEN-123', json_encode($data));
			$this->assertStringNotContainsString('https://drop.example.invalid', str_replace('\/', '/', json_encode($data)));
			return true;
		}));
		$response = (new PageController($this->createMock(IRequest::class), $state, $apps, $config, $version, $this->createMock(IConfig::class)))->index(); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame('cc_projects', $response->getApp());
	}

	// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	public function testIndexPassesTheCrashLogSwitchAndTheVersionsToThePageAlongsideTheBugReportState(): void { // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appConfig = $this->createMock(IAppConfig::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appConfig->method('getValueString')->willReturnCallback(fn ($app, $key, $default = '') => $key === 'crash_log' ? '0' : 'x'); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appManager = $this->createMock(IAppManager::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$appManager->method('getAppVersion')->willReturn('0.1.0'); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$config = $this->createMock(IConfig::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$config->method('getSystemValueString')->with('version', '')->willReturn('33.0.10.1'); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$state = $this->createMock(IInitialState::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$state->expects($this->once())->method('provideInitialState')->with('bugReport', $this->isType('array')); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$version = $this->createMock(ServerVersion::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$controller = new PageController($this->createMock(IRequest::class), $state, $appManager, $appConfig, $version, $config); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

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
		$controller = new PageController($this->createMock(IRequest::class), $this->createMock(IInitialState::class), $this->createMock(IAppManager::class), $appConfig, $this->createMock(ServerVersion::class), $this->createMock(IConfig::class), $logger); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

		$this->expectException(\RuntimeException::class); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
		$controller->index(); // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	} // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
}
