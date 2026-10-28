# Bug reports

Projects uses craft-bugreport-web at revision `4549b81`. Configure the drop in Administration → Projects, or with server-side app config:

```sh
php occ config:app:set cc_projects bug_drop_base --value=https://drop.example.invalid
php occ config:app:set cc_projects bug_drop_token --value=TEST-TOKEN-123
```

These are fake examples. The base and token stay on the server. The token field is always blank; leaving it blank keeps the saved token, and Clear saved token removes it. With empty configuration, the navigation says reports are not set up and the relay returns 503.

Select an area in navigation, or interact with its panel, to make its projects and tasks available as `area.json`. All areas and Needs filing have no working file. The form starts with the working-file checkbox unticked; the consent screen lists every file before Send.
