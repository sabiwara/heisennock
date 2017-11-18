import * as path from "path";
import { expect } from "chai";
import * as sinon from "sinon";
import * as superagent from "superagent";
import * as originalNock from "nock";
import hnock from "../src";

const sandbox = sinon.createSandbox();

describe("hnock", () => {
  afterEach(() => {
    sandbox.restore();
    originalNock.cleanAll();
  });

  describe("#cleanAll()", () => {
    const cleanStub = sandbox.stub(originalNock, "cleanAll");
    hnock.cleanAll();
    expect(cleanStub.args).to.deep.equal([[]]);
  });

  describe("#reply()", () => {
    it("should work with status", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .reply(242);

      const { status, body, header } = await superagent.get("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body, header }).to.deep.equal({
        status: 242,
        body: {},
        header: {}
      });
    });

    it("should work with status, object body", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body, header } = await superagent.get("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body, header }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" },
        header: {
          "content-type": "application/json"
        }
      });
    });

    it("should work with status, string body", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .reply(242, "Heisenberg");

      const { status, text, header } = await superagent.get("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, text, header }).to.deep.equal({
        status: 242,
        text: "Heisenberg",
        header: {}
      });
    });

    it("should work with status, object body, headers", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .reply(242, { message: "Heisenberg" }, { authorization: "Bearer token" });

      const { status, body, header } = await superagent.get("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body, header }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" },
        header: {
          authorization: "Bearer token",
          "content-type": "application/json"
        }
      });
    });

    it("should throw when calling with a wrong url", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .reply(242, { message: "Heisenberg" }, { authorization: "Bearer token" });

      const err = await superagent.get("http://localhost:9000/wrong/path")
        .catch(_err => _err);

      expect(nocked.callCount).to.equal(0);
      expect(err).to.be.an("Error")
        .with.property("message").that.matches(/^Nock: No match for request/);
      expect(nocked.urls()).to.deep.equal([]);
      expect(nocked.allHeaders()).to.deep.equal([]);
      expect(nocked.queries()).to.deep.equal([]);
      expect(nocked.bodies()).to.deep.equal([]);
    });
  });

  describe("#replyWithError()", () => {
    it("should work with a string", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .replyWithError("Something blew up");

      const err = await superagent.get("http://localhost:9000/some/path")
        .catch(_err => _err);

      expect(nocked.callCount).to.equal(1);
      expect(err).to.be.an("Error")
        .with.property("message", "Something blew up");
    });

    it("should work with an object", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .replyWithError({ message: "Something blew up", code: "BOOM" });

      const { message, code } = await superagent.get("http://localhost:9000/some/path")
        .catch(_err => _err);

      expect(nocked.callCount).to.equal(1);
      expect({ message, code }).to.deep.equal({ message: "Something blew up", code: "BOOM" });
    });
  });

  describe("#replyWithFile()", () => {
    it("should work with a file path and headers", async () => {
      const fixtureFile = path.join(__dirname, "fixture.json");
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .replyWithFile(242, fixtureFile, { "Content-Type": "application/json" });

      const { status, body } = await superagent.get("http://localhost:9000/some/path");

      expect({ status, body }).to.deep.equal({
        status: 242,
        body: {
          firstname: "Jessie",
          lastname: "Pinkman"
        }
      });
      expect(nocked.callCount).to.equal(1);
    });

    it("should work with just a file path", async () => {
      const fixtureFile = path.join(__dirname, "fixture.json");
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .replyWithFile(242, fixtureFile);

      const { status, text } = await superagent.get("http://localhost:9000/some/path");

      expect({ status, text }).to.deep.equal({
        status: 242,
        text: `{"firstname":"Jessie","lastname":"Pinkman"}`
      });
      expect(nocked.callCount).to.equal(1);
    });
  });

  describe("#times()", () => {
    it("should specify the desired number of interceptors", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .times(2)
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent.post("http://localhost:9000/some/path");
      await superagent.post("http://localhost:9000/some/path");
      const err = await superagent.post("http://localhost:9000/some/path")
        .catch(_err => _err);

      expect(nocked.callCount).to.equal(2);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });
      expect(err).to.be.an("Error")
        .with.property("message").that.matches(/^Nock: No match for request/);
    });
  });

  describe("#header() #headers() #allHeaders()", () => {
    it("should return the desired header value", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent
        .post("http://localhost:9000/some/path")
        .set("X-Custom-Header", "custom-value")
        .send({ message: "Say my name" });

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });

      expect(nocked.header("X-Custom-Header")).to.equal("custom-value");

      expect(nocked.headers("X-Custom-Header")).to.deep.equal(
        { "x-custom-header": "custom-value" });

      expect(nocked.allHeaders("X-Custom-Header")).to.deep.equal([
        { "x-custom-header": "custom-value" }
      ]);
    });

    it("should throw when calling header() without a call", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      expect(nocked.callCount).to.equal(0);
      expect(nocked.queries()).to.deep.equal([]);

      let err;
      try {
        nocked.header("X-Custom-Headers");
      } catch (_err) {
        err = _err;
      }

      expect(err).to.be.an("Error")
        .with.property("message", "Heisennock Error: No match");
    });
  });

  describe("#query() #queries()", () => {
    it("should return the query object(s)", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent
        .post("http://localhost:9000/some/path?param1=198447&param2=ifjkhh,dhd")
        .send({ message: "Say my name" });

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });

      expect(nocked.query()).to.deep.equal({
        param1: "198447",
        param2: "ifjkhh,dhd"
      });

      expect(nocked.queries()).to.deep.equal([{
        param1: "198447",
        param2: "ifjkhh,dhd"
      }]);
    });

    it("should throw when calling query() without a call", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      expect(nocked.callCount).to.equal(0);
      expect(nocked.queries()).to.deep.equal([]);

      let err;
      try {
        nocked.query();
      } catch (_err) {
        err = _err;
      }

      expect(err).to.be.an("Error")
        .with.property("message", "Heisennock Error: No match");
    });
  });

  describe("#url() #urls()", () => {
    it("should return the relative url without querystring", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent
        .post("http://localhost:9000/some/path?param1=198447&param2=ifjkhh,dhd")
        .send({ message: "Say my name" });

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });

      expect(nocked.url()).to.equal("/some/path");

      expect(nocked.urls()).to.deep.equal(["/some/path"]);
    });

    it("should throw when calling url() without a call", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      expect(nocked.callCount).to.equal(0);

      expect(nocked.urls()).to.deep.equal([]);

      let err;
      try {
        nocked.url();
      } catch (_err) {
        err = _err;
      }

      expect(err).to.be.an("Error")
        .with.property("message", "Heisennock Error: No match");
    });
  });

  describe("#body() #bodies()", () => {
    it("should return the query object(s)", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent
        .post("http://localhost:9000/some/path?param1=198447&param2=ifjkhh,dhd")
        .send({ message: "Say my name" });

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });

      expect(nocked.body()).to.deep.equal({ message: "Say my name" });

      expect(nocked.bodies()).to.deep.equal([{ message: "Say my name" }]);
    });

    it(" should throw when calling body() without a call", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      expect(nocked.callCount).to.equal(0);
      expect(nocked.bodies()).to.deep.equal([]);

      let err;
      try {
        nocked.body();
      } catch (_err) {
        err = _err;
      }

      expect(err).to.be.an("Error")
        .with.property("message", "Heisennock Error: No match");
    });
  });

  describe("HTTP verbs", () => {
    it("should work with a basic GET case", async () => {
      const nocked = hnock("http://localhost:9000")
        .get("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent.get("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });
    });

    it("should work with a basic HEAD case", async () => {
      const nocked = hnock("http://localhost:9000")
        .head("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status } = await superagent.head("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status }).to.deep.equal({
        status: 242
      });
    });

    it("should work with a basic POST case", async () => {
      const nocked = hnock("http://localhost:9000")
        .post("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent.post("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });
    });

    it("should work with a basic PATCH case", async () => {
      const nocked = hnock("http://localhost:9000")
        .patch("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent.patch("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });
    });

    it("should work with a basic PUT case", async () => {
      const nocked = hnock("http://localhost:9000")
        .put("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent.put("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });
    });

    it("should work with a basic DELETE case", async () => {
      const nocked = hnock("http://localhost:9000")
        .delete("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent.delete("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });
    });

    it("should work with a basic OPTIONS case", async () => {
      const nocked = hnock("http://localhost:9000")
        .options("/some/path")
        .reply(242, { message: "Heisenberg" });

      const { status, body } = await superagent.options("http://localhost:9000/some/path");

      expect(nocked.callCount).to.equal(1);
      expect({ status, body }).to.deep.equal({
        status: 242,
        body: { message: "Heisenberg" }
      });
    });
  });
});
