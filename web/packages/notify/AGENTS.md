# Notify

`@atlas/notify` is Atlas's dependency-free notification delivery engine. It owns provider authentication,
payload translation, dispatch, and optional process isolation. User accounts, device registration, preferences,
campaigns, queues, and billing remain application concerns.

## Providers

- APNs token authentication with production and sandbox hosts.
- Firebase Cloud Messaging HTTP v1 with service-account OAuth.
- Console delivery for local development and tests.

Use `createNotifier` for custom providers or `createConfiguredNotifier` for the built-ins. Failed delivery is a
`NotifyResult`, not an exception. `retryable` is set for throttling, network failures, and server errors.

## Isolation

`serveNotify` exposes `POST /notify` behind a required bearer token and `GET /health`. Bind it to loopback unless
the caller supplies network-level protection. `createNotifySubprocess` launches the same implementation under Bun
and sends configuration over stdin, keeping credentials out of process arguments.

## Verification

```sh
bun test packages/notify
bunx tsc --noEmit
```
