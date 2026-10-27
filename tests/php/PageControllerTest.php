<?php

declare(strict_types=1);

namespace OCA\CcProjects\Tests;

use OCA\CcProjects\Controller\PageController;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;

final class PageControllerTest extends TestCase {
	public function testIndexReturnsTheMainTemplate(): void {
		$controller = new PageController($this->createMock(IRequest::class));

		$response = $controller->index();

		$this->assertInstanceOf(TemplateResponse::class, $response);
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame('cc_projects', $response->getApp());
	}
}
