<?php
/** @var array $_ */
script('cc_projects', 'cc_projects-main');
style('cc_projects', 'cc_projects-style');
?>
<div id="cc_projects" data-crash-log="<?php p($_['crashLog']); ?>" data-app-version="<?php p($_['appVersion']); ?>" data-nc-version="<?php p($_['ncVersion']); ?>"></div><?php // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28) ?>
