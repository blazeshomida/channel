# channel

Workspace for `@blazeshomida/channel`.

`@blazeshomida/channel` is a typed message channel for workers and other transports. The package is private while the API is being explored.

## Workspace

```txt
packages/
  channel/
```

## Commands

```sh
vp check
vp run -r test
vp run -r build
vp run @blazeshomida/channel#pack
```

## Development

Run package build watch mode:

```sh
vp run @blazeshomida/channel#dev
```

Run checks before committing:

```sh
vp check
vp run -r test
vp run -r build
```

## Package

The package source lives in:

```txt
packages/channel
```

Package build output is generated in:

```txt
packages/channel/dist
```

## Status

This workspace is currently for API exploration. Publishing metadata and public documentation will be added once the package API stabilizes.
