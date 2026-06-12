# @blazeshomida/channel

## 0.1.0

### Minor Changes

- [#12](https://github.com/blazeshomida/channel/pull/12) [`18f4916`](https://github.com/blazeshomida/channel/commit/18f491673fe8cec9437c39548f6a7030dc234a05) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Add pull-based peer streams.

- [#25](https://github.com/blazeshomida/channel/pull/25) [`1cebdd2`](https://github.com/blazeshomida/channel/commit/1cebdd2c1d9126541e810775e0fb32ae2f5b0de7) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Align public peer API names with the package's canonical language.

- [`282f2af`](https://github.com/blazeshomida/channel/commit/282f2afc213e1f462cfbb0247c48128267b0fd22) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Add the initial peer request response protocol.

- [#1](https://github.com/blazeshomida/channel/pull/1) [`2e3b091`](https://github.com/blazeshomida/channel/commit/2e3b0918d76355ab78dd209e08475c7817f13795) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Add worker client and host transports.

- [#24](https://github.com/blazeshomida/channel/pull/24) [`f2cc925`](https://github.com/blazeshomida/channel/commit/f2cc9251a0dd4dc252876e213d38327d0217769b) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Simplify `createContract` to accept the operation map directly.

- [#11](https://github.com/blazeshomida/channel/pull/11) [`7303b0b`](https://github.com/blazeshomida/channel/commit/7303b0bb5a63289b8a578c7730ef8af3d37537d9) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Add peer request and handler cancellation.

- [#13](https://github.com/blazeshomida/channel/pull/13) [`d5eb5e1`](https://github.com/blazeshomida/channel/commit/d5eb5e1cde2f97e5a230d10e30e4588e3e62f8d8) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Bind peers to typed operation contracts with optional Standard Schema validation.

- [`ae3af0a`](https://github.com/blazeshomida/channel/commit/ae3af0ad3020e5402a3680e3a9420be75327729b) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Add the initial typed channel and transport APIs.

### Patch Changes

- [#24](https://github.com/blazeshomida/channel/pull/24) [`1a8819a`](https://github.com/blazeshomida/channel/commit/1a8819ae0a9d0811eefa0de0f1cd45b41b1ca08e) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Keep ignoring late messages after cancelled operation tracking reaches its bounded limit.

- [#24](https://github.com/blazeshomida/channel/pull/24) [`a44d103`](https://github.com/blazeshomida/channel/commit/a44d10339445743fbd626483ca3255b98cb35164) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Roll back pending request and stream state when transport sends fail.

- [#24](https://github.com/blazeshomida/channel/pull/24) [`8d212f1`](https://github.com/blazeshomida/channel/commit/8d212f17e8e305acc48fad909120da13039cf5fa) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Validate inbound peer protocol messages before lifecycle dispatch.

- [#24](https://github.com/blazeshomida/channel/pull/24) [`aceee2c`](https://github.com/blazeshomida/channel/commit/aceee2c39538e0bd0e51b84a717b4f7598540e92) Thanks [@blazeshomida](https://github.com/blazeshomida)! - Prevent throwing peer error callbacks from interrupting protocol settlement.
