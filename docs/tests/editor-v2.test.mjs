// Optional test dependencies: npm install --no-save --package-lock=false playwright @sparticuz/chromium
// Run: node docs/tests/editor-v2.test.mjs (opens the standalone file, no server required).
import { chromium } from "playwright";
import packagedChromium from "@sparticuz/chromium";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const browser = await chromium.launch({
  executablePath: await packagedChromium.executablePath(),
  args: packagedChromium.args,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.error(e.message);
});
const url = pathToFileURL(path.resolve("docs/editor-v2-mockup.html")).href;
const check = async (name, fn) => {
  await fn();
  console.log("PASS", name);
};
try {
  await page.goto(url);
  await check("initial canvas and field selection", async () => {
    assert.equal(await page.locator(".field").count(), 4);
    await page.locator("#field-1").click();
    assert.match(await page.locator("#inspector").innerText(), /Short answer/);
  });
  await check("picker search, keyboard insertion, no results", async () => {
    await page
      .getByRole("button", { name: "Add field", exact: true })
      .first()
      .click();
    await page.getByLabel("Search field types").fill("nonexistent");
    assert.match(await page.locator("#typeList").innerText(), /No matching/);
    await page.getByLabel("Search field types").fill("number");
    await page.getByLabel("Search field types").press("Enter");
    assert.equal(await page.locator(".field").count(), 5);
  });
  await check("label edit, duplicate, reorder, delete, undo/redo", async () => {
    await page
      .locator("#inspector")
      .getByLabel("Label", { exact: true })
      .fill("Team size");
    await page
      .locator("#inspector")
      .getByLabel("Label", { exact: true })
      .press("Tab");
    assert.match(
      await page.locator(".field.selected").innerText(),
      /Team size/,
    );
    await page.getByLabel("Duplicate field", { exact: true }).click();
    assert.equal(await page.locator(".field").count(), 6);
    await page.getByLabel("Move field down", { exact: true }).click();
    await page.getByLabel("Delete field", { exact: true }).click();
    assert.equal(await page.locator(".field").count(), 5);
    await page.getByLabel("Undo", { exact: true }).click();
    assert.equal(await page.locator(".field").count(), 6);
    await page.getByLabel("Redo", { exact: true }).click();
    assert.equal(await page.locator(".field").count(), 5);
  });
  await check("settings general/layout/appearance/submission", async () => {
    await page
      .getByRole("button", { name: "Form settings", exact: true })
      .click();
    await page
      .getByLabel("Form title", { exact: true })
      .fill("Contact our team");
    await page.getByLabel("Form title", { exact: true }).press("Tab");
    await page
      .locator("#settingsNav")
      .getByRole("button", { name: "Layout", exact: true })
      .click();
    await page.getByLabel("Columns", { exact: true }).selectOption("2");
    await page.getByLabel("Form width", { exact: true }).selectOption("wide");
    await page
      .getByLabel("Field spacing", { exact: true })
      .selectOption("compact");
    await page
      .locator("#settingsNav")
      .getByRole("button", { name: "Appearance", exact: true })
      .click();
    await page.getByLabel("Forest accent").click();
    await page.getByLabel("Typography").selectOption("serif");
    await page.getByLabel("Input & button corners").selectOption("square");
    await page
      .locator("#settingsNav")
      .getByRole("button", { name: "Submission", exact: true })
      .click();
    await page.getByLabel("Submit button label").fill("Contact us");
    await page.getByLabel("Submit button label").press("Tab");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(
      await page.locator("#canvasTitle").innerText(),
      "Contact our team",
    );
    assert.equal(await page.locator("#submitSample").innerText(), "Contact us");
  });
  await check("choice options update", async () => {
    await page.locator("#field-3").click();
    await page.getByLabel("Option 1", { exact: true }).fill("Support");
    await page.getByLabel("Option 1", { exact: true }).press("Tab");
    await page.getByRole("button", { name: "Add option", exact: true }).click();
    assert.equal(await page.locator(".choice-edit").count(), 4);
    await page.getByLabel("Remove option 4").click();
    assert.equal(await page.locator(".choice-edit").count(), 3);
  });
  await check("conditional visibility and preview validation", async () => {
    await page.locator("#field-4").click();
    await page.getByText("Conditional visibility", { exact: true }).click();
    await page.getByLabel("Show field", { exact: true }).selectOption("1");
    await page.getByLabel("Condition", { exact: true }).selectOption("filled");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    assert.equal(await page.locator("#answer-wrap-4").isVisible(), false);
    await page.getByRole("button", { name: "Contact us", exact: true }).click();
    assert.match(await page.locator("#error-1").innerText(), /Please answer/);
    await page.locator("#answer-1").fill("Alex");
    assert.equal(await page.locator("#answer-wrap-4").isVisible(), true);
    await page.locator("#answer-2").fill("bad");
    await page.getByRole("button", { name: "Contact us", exact: true }).click();
    assert.match(await page.locator("#error-2").innerText(), /valid email/);
    await page.locator("#answer-2").fill("alex@example.com");
    await page.getByRole("button", { name: "Mobile", exact: true }).click();
    assert.equal(await page.locator(".preview-paper.mobile").count(), 1);
    assert.equal(await page.locator("#answer-1").inputValue(), "Alex");
    await page.getByRole("button", { name: "Contact us", exact: true }).click();
    assert.match(
      await page.locator("#previewBody").innerText(),
      /Response complete/,
    );
    await page.getByRole("button", { name: "Submit another response" }).click();
    assert.equal(await page.locator("#answer-1").inputValue(), "");
    await page.getByLabel("Close preview", { exact: true }).click();
  });
  await check("publish snapshot and dirty state", async () => {
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish demo", exact: true })
      .click();
    assert.match(
      await page.locator("#publishTitle").innerText(),
      /Demo published/,
    );
    await page.getByRole("button", { name: "Back to editor" }).click();
    assert.equal(await page.locator("#publishBtn").isDisabled(), true);
    await page.locator("#field-1").click();
    await page
      .locator("#inspector")
      .getByLabel("Label", { exact: true })
      .fill("Name");
    await page
      .locator("#inspector")
      .getByLabel("Label", { exact: true })
      .press("Tab");
    assert.match(
      await page.locator("#status").innerText(),
      /Unpublished changes/,
    );
  });
  await check(
    "jump search and native dialog focus containment/Escape return",
    async () => {
      await page.getByRole("button", { name: "5 fields" }).click();
      await page.getByLabel("Find a field").fill("message");
      await page.locator("#jumpList button").click();
      assert.match(
        await page.locator(".field.selected").innerText(),
        /Your message/,
      );
      await page
        .getByRole("button", { name: "Form settings", exact: true })
        .click();
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () => document.activeElement.closest("dialog")?.id,
          ),
          "settings",
        );
      }
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#settings").isVisible(), false);
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "settingsBtn",
      );
    },
  );
  await page.screenshot({ path: "/tmp/editor-v2-desktop.png", fullPage: true });
  await check("mobile canvas, settings and field panel", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator("#field-1").click();
    assert.equal(await page.locator("#inspector").isVisible(), true);
    await page.getByLabel("Close field settings", { exact: true }).click();
    assert.equal(await page.locator("#inspector").isVisible(), false);
    await page
      .getByRole("button", { name: "Form settings", exact: true })
      .click();
    assert.equal(
      await page
        .locator("#settings")
        .evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: "/tmp/editor-v2-mobile.png",
      fullPage: true,
    });
  });

  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.reload();
  await check("drag reordering and condition cleanup", async () => {
    await page.locator("#field-2").click();
    await page
      .getByLabel("Drag to reorder", { exact: true })
      .dragTo(page.locator("#field-4"));
    assert.deepEqual(
      await page.locator(".field").evaluateAll((els) => els.map((e) => e.id)),
      ["field-1", "field-3", "field-4", "field-2"],
    );
    await page.locator("#field-4").click();
    await page.getByText("Conditional visibility", { exact: true }).click();
    await page.getByLabel("Show field", { exact: true }).selectOption("1");
    await page.locator("#field-1").click();
    await page.getByLabel("Delete field", { exact: true }).click();
    assert.equal(
      await page.evaluate(() => state.fields.find((f) => f.id === 4).rule),
      undefined,
    );
  });
  await check("all field types insert and render in preview", async () => {
    for (const type of [
      "text",
      "textarea",
      "email",
      "number",
      "tel",
      "date",
      "select",
      "radio",
      "checkbox",
      "file",
    ]) {
      await page.evaluate((type) => addField(type), type);
    }
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    assert.equal(await page.locator(".answer").count(), 13);
    await page.getByLabel("Close preview", { exact: true }).click();
  });
  await check(
    "number, length and local file validation; type change resets validation",
    async () => {
      await page.evaluate(() => {
        selected = state.fields.find((f) => f.type === "number").id;
        renderInspector();
      });
      await page
        .locator("#inspector summary")
        .getByText("Validation", { exact: true })
        .click();
      await page.getByLabel("Minimum value", { exact: true }).fill("3");
      await page.getByLabel("Maximum value", { exact: true }).fill("10");
      assert.equal(
        await page.evaluate(() => {
          answers[field().id] = "2";
          return validate(field());
        }),
        "Enter 3 or more.",
      );
      await page.getByLabel("Field type", { exact: true }).selectOption("text");
      assert.equal(await page.evaluate(() => field().min), undefined);
      await page
        .locator("#inspector summary")
        .getByText("Validation", { exact: true })
        .click();
      await page.getByLabel("Maximum characters", { exact: true }).fill("5");
      assert.equal(
        await page.evaluate(() => {
          answers[field().id] = "abcdef";
          return validate(field());
        }),
        "Use 5 characters or fewer.",
      );
      await page.evaluate(() => {
        selected = state.fields.find((f) => f.type === "file").id;
        renderInspector();
      });
      await page
        .locator("#inspector summary")
        .getByText("Validation", { exact: true })
        .click();
      await page
        .getByLabel("Maximum file size (MB)", { exact: true })
        .fill("1");
      assert.equal(
        await page.evaluate(() => {
          answers[field().id] = { name: "large.txt", size: 2000000 };
          return validate(field());
        }),
        "Choose a file smaller than 1 MB.",
      );
    },
  );
  await check(
    "empty form and invalid labels block publishing; undo restores",
    async () => {
      await page.evaluate(() => {
        change(() => (state.title = ""));
      });
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      assert.equal(await page.locator("#confirmPublish").isDisabled(), true);
      await page.getByLabel("Close publish", { exact: true }).click();
      await page.evaluate(() => {
        change(() => (state.fields = []));
        selected = null;
        renderInspector();
      });
      assert.match(
        await page.locator("#fields").innerText(),
        /Your form starts here/,
      );
      await page.getByLabel("Undo", { exact: true }).click();
      assert.equal(await page.locator(".field").count(), 13);
    },
  );
  assert.deepEqual(errors, []);
  console.log("PASS no browser JavaScript errors");
} finally {
  await browser.close();
}
