import { parse as parseUrl } from "url";
import * as querystring from "querystring";
import * as nock from "nock";

const GET = "GET";
const HEAD = "HEAD";
const POST = "POST";
const PATCH = "PATCH";
const PUT = "PUT";
const DELETE = "DELETE";
const OPTIONS = "OPTIONS";

export type httpMethod = "GET" | "HEAD" | "POST" | "PATCH" | "PUT" | "DELETE" | "OPTIONS";
export type HttpDomain = string | RegExp;
export type RelativeUrl = string | RegExp;


export interface InterceptorParams {
  basePath: HttpDomain;
  method: httpMethod;
  relativeUrl: RelativeUrl;
  times: number;
}

export interface HttpHeaders {
  [key: string]: string;
}

export interface PartialInterceptor {
  reply(status: number, body?: any, headers?: HttpHeaders): Interceptor;
  replyWithError(error: any): Interceptor;
  times(times: number): PartialInterceptor;
}

export interface Interceptor {
  callCount: number;
  original: nock.Interceptor;
  header(key: string): string;
  header(key: string): string;
  headers(...keys: Array<string>): HttpHeaders;
  allHeaders(...keys: Array<string>): Array<HttpHeaders>;
  query(): object;
  queries(): Array<object>;
  body(): object;
  bodies(): Array<object>;
  url(): string;
  urls(): Array<string>;
}

export interface PartialScope {
  get(uri: string): PartialInterceptor;
  head(uri: string): PartialInterceptor;
  post(uri: string): PartialInterceptor;
  patch(uri: string): PartialInterceptor;
  put(uri: string): PartialInterceptor;
  delete(uri: string): PartialInterceptor;
  options(uri: string): PartialInterceptor;
}

export interface Heisennock {
  (basePath: HttpDomain): PartialScope;
  cleanAll: () => void;
}

const heisennock = <Heisennock>function heisennock(basePath: HttpDomain): PartialScope {
  return {
    get: (uri: RelativeUrl): PartialInterceptor => _createScopeInterceptor(GET, basePath, uri),
    head: (uri: RelativeUrl): PartialInterceptor => _createScopeInterceptor(HEAD, basePath, uri),
    post: (uri: RelativeUrl): PartialInterceptor => _createScopeInterceptor(POST, basePath, uri),
    patch: (uri: RelativeUrl): PartialInterceptor => _createScopeInterceptor(PATCH, basePath, uri),
    put: (uri: RelativeUrl): PartialInterceptor => _createScopeInterceptor(PUT, basePath, uri),
    delete: (uri: RelativeUrl): PartialInterceptor => _createScopeInterceptor(DELETE, basePath, uri),
    options: (uri: RelativeUrl): PartialInterceptor => _createScopeInterceptor(OPTIONS, basePath, uri)
  };
};

heisennock.cleanAll = cleanAll;
export default heisennock;

export function cleanAll() {
  nock.cleanAll();
}

interface Trap<T> {
  trapCallback: (param: T) => boolean;
  trapped: Array<T>;
}

function _createScopeInterceptor(method: httpMethod, basePath: HttpDomain, relativeUrl: RelativeUrl): PartialInterceptor {
  const params = {
    basePath,
    method,
    relativeUrl,
    times: Infinity
  };
  return _createPartialInterceptor(params);
}

function _createPartialInterceptor(params: InterceptorParams): PartialInterceptor {
  function reply(status: number, body?: any, headers?: HttpHeaders): Interceptor {
    const interceptor = _buildInterceptor(params);
    interceptor.original.reply(status, body, headers);
    return interceptor;
  }
  function replyWithError(error: any): Interceptor {
    const interceptor = _buildInterceptor(params);
    interceptor.original.replyWithError(error);
    return interceptor;
  }
  function times(times: number): PartialInterceptor {
    return _createPartialInterceptor({ ...params, times });
  }
  return {
    reply,
    replyWithError,
    times
  };
}

function _buildInterceptor(params: InterceptorParams): Interceptor {
  const _headers: Array<HttpHeaders> = [];
  const _queries: Array<object> = [];
  const _bodies: Array<object> = [];
  const _urls: Array<string> = [];
  const baseScope = nock(params.basePath);
  baseScope.on("request", ctx => {
    _headers.push(ctx.headers);
    const rawUrl: string = ctx.path;
    const parsedUrl = parseUrl(rawUrl);
    /* istanbul ignore else */
    if (parsedUrl.pathname) {
      _urls.push(parsedUrl.pathname);
    }
    const qs = querystring.parse(parsedUrl.query);
    _queries.push(qs);
    return true;
  });
  const httpMethod = getNockScopeHTTPMethod(baseScope, params.method);
  const original = httpMethod.call(baseScope, params.relativeUrl, (body: object) => {
    interceptor.callCount += 1;
    _bodies.push(body);
    return true;
  })
    .query(true)
    .times(params.times);

  const interceptor = {
    original,
    callCount: 0,
    header,
    headers,
    allHeaders,
    query,
    queries,
    body,
    bodies,
    url: url,
    urls,
  };

  return interceptor;

  function header(name: string): string {
    return _getFirstIntercepted(_headers)[name.toLowerCase()];
  }

  function headers(...names: Array<string>): HttpHeaders {
    return _pickHeaders(_getFirstIntercepted(_headers), names);
  }
  function allHeaders(...names: Array<string>): Array<HttpHeaders> {
    return _headers.map(headers => _pickHeaders(headers, names));
  }

  function query(): object {
    return _getFirstIntercepted(_queries);
  }

  function queries(): Array<object> {
    return _queries.concat();
  }

  function url(): string {
    return _getFirstIntercepted(_urls);
  }

  function urls(): Array<string> {
    return _urls.concat();
  }

  function body(): object {
    return _getFirstIntercepted(_bodies);
  }

  function bodies(): Array<object> {
    return _bodies.concat();
  }
}

function _getFirstIntercepted<T>(intercepted: Array<T>): T {
  if (!intercepted.length) throw new Error("Heisennock Error: No match");
  return intercepted[0];
}

function _pickHeaders(headers: HttpHeaders, names: Array<string>): HttpHeaders {
  const interestingHeaders: HttpHeaders = {};
  for (const name of names) {
    const key = name.toLowerCase();
    interestingHeaders[key] = headers[key];
  }
  return interestingHeaders;
}

function getNockScopeHTTPMethod(scope: nock.Scope, method: httpMethod): nock.InterceptFunction {
  switch (method) {
    case GET: return scope.get;
    case HEAD: return scope.head;
    case POST: return scope.post;
    case PATCH: return scope.patch;
    case PUT: return scope.put;
    case DELETE: return scope.delete;
    case OPTIONS: return scope.options;
  }
}
