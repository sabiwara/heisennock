# heisennock

[![Build Status](https://travis-ci.org/sabiwara/heisennock.svg?branch=master)](https://travis-ci.org/sabiwara/heisennock)
[![codecov](https://codecov.io/gh/sabiwara/heisennock/branch/master/graph/badge.svg)](https://codecov.io/gh/sabiwara/heisennock)

`heisennock` is a TDD-friendly wrapper for the awesome HTTP mocking library [nock](https://github.com/node-nock/nock).
It totally removes the assertion logic from `nock`, focusing on the mocking and making **contract checking** a breeze by using the assertion library of your choice ([chai](http://chaijs.com/)...).

> "I am the one who nocks." Walter White, a.k.a. Heisenberg

![I am the one who knocks](./heisenberg.jpg)

## Contract checking?

Asserting on mocks (HTTP or other stubs) call parameters is the key to do proper contract checking.
Too often, developers tend to squeeze this part because it does not bring any "coverage".
However, mocking without asserting on parameters is nothing but a **coverage lie**,
leaving the code vulnerable to possible regressions whch could easily be avoided.

## Why a wrapper?

While `nock` is perfect for mocking outbound HTTP calls, it unfortunately also tries to handle the assertion part.
The resulting mix between matching rules and assertions can end up making TDD very unpratical:
- we do not know for sure the callback was called and how many times
- no helpful stacktrace (because the assertion is done in a callback)
- no helpful diff

See the following snippet for a concrete example.

```javascript
const nock = require('nock');

// recommended by nock's documentation
const myNock = nock('http://localhost:9876')
  .post('/some/path', { message: 'Say my name!' })
  .reply(201);

theCallWeAreTesting();

// test a call with the body: { message: 'Wrong message :(' }
// => ends up with a `Nock: No match for request ...` Error, no helpful stacktrace
```

For a more TDD-friendly way of failing, we could come up with the following hack:

```javascript
const nock = require('nock');

// hijacking nock's API
let payload;
const myNock = nock('http://localhost:9876')
  .post('/some/path', _payload => {
    payload = _payload;  // use a closure to "capture" the body
    return true;  // lie to the nock matcher so we can handle our assertion later
  })
  .reply(201);

theCallWeAreTesting();

// => now we'll get a proper diff and stacktrace, and know exactly why we failed
expect(payload).to.deep.equal({ message: 'Say my name!' });
```

> "Oh my god, this is ugly!"

This is far more maintainable and makes for more robust tests.
But, this is indeed ugly and discourages developers to do proper contract checking.

This is where Heisennock comes in:

```javascript
const { hnock } = require('heisennock');

// Now we get to keep both:
// 1) the lean API of the original nock
const myNock = hnock('http://localhost:9876')
  .post('/some/path')
  .reply(201);

theCallWeAreTesting();

// 2) a simple way of doing a proper maintainable assertion
expect(myNock.payload()).to.deep.equal({ message: 'Say my name!' });
```

## Install

```sh
$ npm install heisennock
```

## Use

### Always clean after your tests

For maintainable tests, we recommend you to always call `cleanAll` after each test.
This way you always leave a non-polluted HTTP layer behind you.

With [mocha](http://mochajs.org/), this will is typically done as follows:

```javascript
const { hnock } = require('heisennock');

describe('...', () => {
  afterEach(() => hnock.cleanAll());

  // the tests
})
```

### Always perform assertions

As said above, it is critical to perform proper contract checking on your mocks.
Always assert that the following items are matching your expectations:
- numbers of calls
- headers
- payloads (bodies)
- querystrings

```javascript
const myNock = hnock('http://localhost:9876')
  .post(/^\/api//)
  .reply(201);

theCallWeAreTesting();

// simple APIs for single calls (covers most cases)
expect(myNock.callCount).to.equal(1);
expect(myNock.url()).to.equal('/api/path');
expect(myNock.header('authorization')).to.equal('Bearer token');
expect(myNock.headers('authorization', 'accept'))
  .to.deep.equal({ authorization: 'Bearer token', accept: 'application/json' });
expect(myNock.payload()).to.deep.equal({ message: 'Say my name!' });
expect(myNock.query()).to.deep.equal({ q: 'heisenberg' });
```

### Support for multiple calls

```javascript
// array APIs for multiple calls
expect(myNock.callCount).to.equal(2);
expect(myNock.urls()).to.deep.equal([
  '/api/path',
  '/api/other_path'
]);
expect(myNock.allHeaders('authorization')).to.deep.equal([
  { authorization: 'Bearer token1' },
  { authorization: 'Bearer token2' }
  );
expect(myNock.payloads()).to.deep.equal([
  { message: 'Say my name!' },
  { message: 'You\'re goddam right!' }
]);
expect(myNock.queries()).to.deep.equal([
  { q: 'walter' },
  { q: 'white' }
]);
```

### Supported nock features

#### replyWithError()

Same as the original method from `nock`.

```javascript
const myNock = hnock('http://localhost:9876')
  .post('/some/path')
  .replyWithError({ code: 'ECONNREFUSED' });
```

#### times()

Same as the original method from `nock`.
`times` can be useful to test different behaviours on a same route, typically for a retry logic.

```javascript
const myFirstNock = hnock('http://localhost:9876')
  .post('/some/path')
  .times(1)
  .replyWithError({ code: 'ECONNREFUSED' });

const mySecondNock = hnock('http://localhost:9876')
  .post('/some/path')
  .times(1)
  .reply(200, 'success');
```

By default, `heisennock` uses `Infinity` because we want multiple calls to be detected by assertion, not matching.
- If you want to make sure your nock was called once, make an assertion on `callCount`
- If you want to simulate several behaviours on a same route, use `times`
