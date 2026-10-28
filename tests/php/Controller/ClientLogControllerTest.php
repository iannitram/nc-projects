<?php
// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

declare(strict_types=1);

namespace OCA\CcProjects\Tests\Controller;

use OCA\CcProjects\Controller\ClientLogController;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class ClientLogControllerTest extends TestCase {
	// This app's own user content: task and project titles, a description, a list (calendar) name, a file
	// name with a query, a path, a URL with a query and the display name.
	private const CANARIES = [
		'CANARY_TASK_TITLE_7f3a',
		'CANARY_PROJECT_TITLE_7f3a',
		'CANARY_DESCRIPTION_7f3a',
		'CANARY_LIST_NAME_7f3a',
		'CANARY_FILE_7f3a.ics',
		'CANARY_QUERY_7f3a',
		'CANARY_USER_7f3a',
		'CANARY_DISPLAY_NAME_7f3a',
	];

	private IRequest&MockObject $request;
	private LoggerInterface&MockObject $logger;

	private function controller(bool $signedIn = true, string $crashLog = '1'): ClientLogController {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createMock(IUserSession::class);
		$session->method('getUser')->willReturn($signedIn ? $user : null);
		$appConfig = $this->createMock(IAppConfig::class);
		$appConfig->method('getValueString')->with('cc_projects', 'crash_log', '1')->willReturn($crashLog);
		$this->request = $this->createMock(IRequest::class);
		$this->logger = $this->createMock(LoggerInterface::class);
		return new ClientLogController($this->request, $appConfig, $session, $this->logger);
	}

	/** @param array<string, mixed> $fields @return array<string, mixed> one event, as the browser sends it */
	private function event(array $fields): array {
		return $fields + [
			'level' => 'error',
			'kind' => 'error',
			'message' => 'TypeError: boom',
			'stack' => '',
			'appVersion' => '0.1.0',
			'ncVersion' => '33.0.10',
			'view' => '#/project/:id',
			'userAgent' => 'Mozilla/5.0',
			'pageId' => 'abc123',
			'time' => '2026-10-28T10:00:00.000Z',
		];
	}

	public function testValidEventsAreLoggedOnceEachAtTheirLevel(): void {
		$controller = $this->controller();
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event(['level' => 'error', 'kind' => 'error', 'message' => 'TypeError: boom', 'stack' => '    at f (https://nc.example/apps/cc_projects/js/cc_projects-main.mjs:1:2)']),
			$this->event(['level' => 'warning', 'kind' => 'save', 'message' => 'save failed']),
		]);
		$this->logger->expects($this->once())->method('error')
			->with($this->stringContains('client error (error): TypeError: boom'), ['app' => 'cc_projects']);
		$this->logger->expects($this->once())->method('warning')
			->with($this->stringContains('client save (warning): save failed'), ['app' => 'cc_projects']);

		$response = $controller->receive();

		$this->assertSame(200, $response->getStatus());
		$this->assertSame(['logged' => 2], $response->getData());
	}

	public function testAnonymousRequestIsRejectedAndNothingIsLogged(): void {
		$controller = $this->controller(false);
		$this->logger->expects($this->never())->method('error');
		$this->logger->expects($this->never())->method('warning');

		$response = $controller->receive();

		$this->assertSame(401, $response->getStatus());
	}

	public function testReceiveIsNotPublicOnTheClassOrTheMethod(): void {
		$class = new \ReflectionClass(ClientLogController::class);
		$method = $class->getMethod('receive');

		$this->assertSame([], $class->getAttributes(PublicPage::class));
		$this->assertSame([], $method->getAttributes(PublicPage::class));
		$this->assertNotSame([], $method->getAttributes(NoAdminRequired::class));
	}

	public function testCrashLogOffReturns403AndLogsNothing(): void {
		$controller = $this->controller(true, '0');
		$this->logger->expects($this->never())->method('error');
		$this->logger->expects($this->never())->method('warning');

		$response = $controller->receive();

		$this->assertSame(403, $response->getStatus());
	}

	public function testCanaryStringsNeverReachTheLogger(): void {
		$controller = $this->controller();
		$lines = [];
		$record = static function (string $line) use (&$lines): void {
			$lines[] = $line;
		};
		$this->logger->method('error')->willReturnCallback($record);
		$this->logger->method('warning')->willReturnCallback($record);
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event([
				'message' => 'failed on "CANARY_TASK_TITLE_7f3a"',
				'stack' => "    at f (https://nc.example/CANARY_FILE_7f3a.ics?x=CANARY_QUERY_7f3a:3:4)\n"
					. '    at g (https://nc.example/apps/cc_projects/js/cc_projects-main.mjs?v=CANARY_DISPLAY_NAME_7f3a:5:6)',
				'view' => '#/CANARY_PROJECT_TITLE_7f3a',
				'userAgent' => 'Mozilla "CANARY_USER_7f3a"',
				'description' => 'CANARY_DESCRIPTION_7f3a',
				'list' => 'CANARY_LIST_NAME_7f3a',
				'path' => '/remote.php/dav/calendars/CANARY_USER_7f3a/CANARY_LIST_NAME_7f3a/',
				'url' => 'https://nc.example/remote.php/dav/calendars/CANARY_USER_7f3a/?token=CANARY_QUERY_7f3a',
			]),
		]);

		$response = $controller->receive();

		$this->assertSame(['logged' => 1], $response->getData());
		$this->assertCount(1, $lines);
		$this->assertStringContainsString('failed on …', $lines[0]);
		$this->assertStringContainsString('at cc_projects-main.mjs:5:6', $lines[0]);
		foreach (self::CANARIES as $canary) {
			$this->assertStringNotContainsString($canary, $lines[0]);
		}
	}

	public function testLiveCanaryCaseNeverReachesTheLogger(): void {
		$controller = $this->controller();
		$lines = [];
		$this->logger->method('error')->willReturnCallback(static function (string $line) use (&$lines): void {
			$lines[] = $line;
		});
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event(['message' => 'Error: CRASHTEST_A uncaught on "CANARY_TASK_TITLE_7f3a" in CANARY_FILE_7f3a.ics?x=CANARY_QUERY_7f3a']),
		]);

		$controller->receive();

		$this->assertCount(1, $lines);
		$this->assertStringContainsString('Error: CRASHTEST_A uncaught on … in <file> |', $lines[0]);
		foreach (['CANARY_TASK_TITLE_7f3a', 'CANARY_FILE_7f3a', 'CANARY_QUERY_7f3a'] as $leaked) {
			$this->assertStringNotContainsString($leaked, $lines[0]);
		}
	}

	/** @return array<string, array{string, string, list<string>}> */
	public static function unquotedProvider(): array {
		return [
			'bare file' => ['failed to open Plan.ics', 'failed to open <file>', ['Plan']],
			'path with spaces' => ['save failed for /Lists/Secret Plan.ics', 'save failed for <file>', ['Lists', 'Secret', 'Plan']],
			'windows path' => ['C:\Users\x\file.txt', '<file>', ['Users', 'file.txt']],
			'url' => ['GET https://host/apps/x?token=abc#frag', 'GET <url>', ['host', 'token', 'abc', 'frag']],
			'query on an id' => ['item 42?draft=1', 'item 42', ['draft']],
			'several extensions' => ['wrote my-notes.ics and a.b.c.txt', 'wrote <file> and <file>', ['notes', 'a.b']],
			'plain message' => ['TypeError: Cannot read properties of undefined', 'TypeError: Cannot read properties of undefined', []],
		];
	}

	/** @param list<string> $absent */
	#[\PHPUnit\Framework\Attributes\DataProvider('unquotedProvider')]
	public function testUnquotedNamesPathsUrlsAndQueriesAreRedacted(string $input, string $expected, array $absent): void {
		$out = ClientLogController::sanitizeText($input);
		$this->assertSame($expected, $out);
		foreach ($absent as $word) {
			$this->assertStringNotContainsString($word, $out);
		}
	}

	public function testStackIsTrimmedTo2KiB(): void {
		$controller = $this->controller();
		$lines = [];
		$this->logger->method('error')->willReturnCallback(static function (string $line) use (&$lines): void {
			$lines[] = $line;
		});
		$stack = str_repeat("    at fn (https://nc.example/apps/cc_projects/js/cc_projects-main.mjs:1:2)\n", 500);
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event(['stack' => $stack]),
		]);

		$controller->receive();

		$this->assertCount(1, $lines);
		$logged = substr($lines[0], strpos($lines[0], 'stack=') + strlen('stack='));
		$this->assertGreaterThan(0, strlen($logged));
		$this->assertLessThanOrEqual(2048, strlen($logged));
	}

	public function testMoreThan20EventsInOneRequestAreCutTo20(): void {
		$controller = $this->controller();
		$events = [];
		for ($i = 0; $i < 25; $i++) {
			$events[] = $this->event(['message' => "error $i"]);
		}
		$this->request->method('getParam')->with('events')->willReturn($events);
		$this->logger->expects($this->exactly(20))->method('error');

		$response = $controller->receive();

		$this->assertSame(['logged' => 20], $response->getData());
	}

	public function testSanitizersStripQuotesQueriesAndAllButAppFrames(): void {
		$this->assertSame('a … … … e', ClientLogController::sanitizeText('a \'b\' "c" `d` e'));
		$this->assertSame('cannot read …', ClientLogController::sanitizeText('cannot read "x of row'));
		$this->assertSame('Failed: <url>', ClientLogController::sanitizeText('Failed: https://nc.example/a.ics?f=1#x'));
		$this->assertSame(
			"at cc_projects-main.mjs:1:2\nat <other>:3:4",
			ClientLogController::sanitizeStack("Error: x\n    at f (https://h/apps/cc_projects/js/cc_projects-main.mjs?v=1:1:2)\n    at g (https://h/other.js:3:4)\n    at <anonymous>"),
		);
		$this->assertSame('#/project/:id', ClientLogController::sanitizeView('#/project/7'));
	}

	public function testControlCharactersAndTrailingNewlinesCannotSplitALogLine(): void {
		$controller = $this->controller();
		$lines = [];
		$this->logger->method('error')->willReturnCallback(static function (string $line) use (&$lines): void {
			$lines[] = $line;
		});
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event([
				'message' => "Error: boom\r\n2026-10-28 FAKE entry\x00\x1b[31m\u{85}x\u{2028}y\u{2029}z\u{9B}",
				'pageId' => "abc123\n",
				'appVersion' => "1.0.0\n",
				'userAgent' => "UA\nFAKE",
				'time' => "2026-10-28T10:00:00Z\n",
			]),
		]);

		$controller->receive();

		$this->assertCount(1, $lines);
		$this->assertSame(0, preg_match('/[\x00-\x1F\x7F-\x{9F}\x{2028}\x{2029}]/u', $lines[0]));
	}

	public function testServerExceptionIsLoggedAtErrorLevelWithTheAppTag(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')
			->with($this->stringContains('server exception in Foo::bar: RuntimeException: row … missing at ClientLogControllerTest.php:'), ['app' => 'cc_projects']);

		ClientLogController::reportServerException($logger, 'Foo::bar', new \RuntimeException('row "CANARY_TASK_TITLE_7f3a" missing'));
	}
}
