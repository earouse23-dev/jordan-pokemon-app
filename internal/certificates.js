import { lookupCertificateFixture } from "./certificate-fixtures.js";

const fixtureOwner = "certificate-fixture-owner";
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
const shown = (value) =>
  value === null || value === undefined || value === ""
    ? "Not available"
    : esc(value);
const versionForComparison = (value) => {
  const parts = String(value).toLowerCase().split(" · ");
  return parts.length === 2 &&
    ((parts[0] === "normal" && parts[1] === "non-holo") ||
      parts[0] === parts[1])
    ? parts[0]
    : String(value).toLowerCase();
};

export function compareCertificate(record, current) {
  const differences = [];
  for (const [label, left, right] of [
    ["Card", record.identity?.name, current.name],
    ["Set", record.identity?.set, current.set],
    ["Number", record.identity?.number, current.number],
    ["Language", record.identity?.language, current.language],
    [
      "Version",
      record.identity?.variant,
      current.variant?.label || current.variant,
    ],
    ["Finish", record.identity?.finish, current.finish],
    ["Grader", record.grader, current.gradingCompany],
    ["Grade", record.grade, current.grade],
    ["Qualifier", record.qualifier, current.gradeQualifier],
    ["Certificate", record.certificate, current.certificationNumber],
  ]) {
    if (
      left &&
      right &&
      (label === "Version"
        ? versionForComparison(left)
        : String(left).toLowerCase()) !==
        (label === "Version"
          ? versionForComparison(right)
          : String(right).toLowerCase())
    )
      differences.push(label);
  }
  return differences;
}

function validResult(result, grader, certificate) {
  if (
    !["match", "not_found", "unsupported", "ambiguous"].includes(result?.status)
  )
    throw new Error("malformed");
  if (result.status !== "match") return result;
  const record = result.record;
  if (
    !record ||
    record.grader !== grader ||
    record.certificate !== certificate ||
    !record.identity ||
    !record.source ||
    !record.observedAt
  )
    throw new Error("malformed");
  if (
    record.identity.language &&
    !["en", "ja", "de"].includes(record.identity.language)
  )
    return { status: "unsupported" };
  return result;
}

function populationMarkup(record) {
  const population = record.population;
  if (!population)
    return '<p id="certificatePopulationMissing">Population not available for this sample.</p>';
  const grades = Array.isArray(population.grades) ? population.grades : [];
  return `<p>Source: ${shown(population.source)} · As of: ${shown(population.asOf)}</p><p>Coverage: ${shown(population.coverage)}</p><p>Total graded: ${Number.isFinite(population.total) ? population.total : "Not available"}</p><table class="certificate-population-table"><thead><tr><th scope="col">Grade</th><th scope="col">Count</th></tr></thead><tbody>${grades.map(({ grade, count }) => `<tr><th scope="row">${esc(grade)}</th><td>${Number.isFinite(count) ? count : "Not available"}</td></tr>`).join("")}</tbody></table>${population.history?.length ? `<h4>Recorded history</h4><ul>${population.history.map(({ asOf, total }) => `<li>${esc(asOf)} · ${Number(total)}</li>`).join("")}</ul>` : "<p>History not available.</p>"}<p>Population counts are not prices, owned copies, or Mica grades.</p>`;
}

function recordMarkup(record, differences, current) {
  const identity = record.identity;
  const subgrades = record.subgrades && Object.entries(record.subgrades);
  const images =
    record.images?.filter(
      ({ url }) => url?.startsWith("./") && !url.includes(".."),
    ) || [];
  const pairs = [
    ["Card", current.name, identity.name],
    ["Set", current.set, identity.set],
    ["Number", current.number, identity.number],
    ["Language", current.language, identity.language],
    ["Version", current.variant?.label || current.variant, identity.variant],
    ["Finish", current.finish, identity.finish],
    ["Grader", current.gradingCompany, record.grader],
    ["Grade", current.grade, record.grade],
    ["Qualifier", current.gradeQualifier, record.qualifier],
    ["Certificate", current.certificationNumber, record.certificate],
  ];
  return `<div id="certificateResult" class="certificate-result"><h3>Sample record match</h3><p>Internal fixture · ${shown(record.source)} · ${shown(record.observedAt)}</p><table class="certificate-comparison-table"><thead><tr><th>Fact</th><th>Current card</th><th>Sample record</th></tr></thead><tbody>${pairs.map(([label, left, right]) => `<tr><th scope="row">${esc(label)}</th><td>${shown(left)}</td><td>${shown(right)}</td></tr>`).join("")}</tbody></table><p>${subgrades?.length ? `Subgrades: ${subgrades.map(([name, value]) => `${esc(name)} ${esc(value)}`).join(" · ")}` : "Subgrades not available."}</p>${images.length ? `<div class="certificate-images">${images.map(({ url, alt }) => `<figure><img src="${esc(url)}" alt="${esc(alt || "Sample image")}"><figcaption>${esc(alt || "Sample image")}</figcaption></figure>`).join("")}</div>` : "<p>Source images not available.</p>"}<p>Matching a certificate record does not authenticate a physical slab.</p><div class="certificate-comparison" role="status">${differences.length ? `Conflicts with current card: ${esc(differences.join(", "))}. Correct or select a matching copy, or keep this sample as unresolved.` : "Matches the available current card facts."}</div><div class="sheet-actions"><button id="certificatePopulation" class="secondary" type="button">Population details</button>${differences.length ? '<button id="certificateReturn" class="secondary" type="button">Return to card</button><button id="certificateUnresolved" class="secondary" type="button">Keep unresolved sample</button>' : '<button id="certificateContinue" class="primary" type="button">Use matching sample</button>'}</div><div id="certificatePopulationPanel" tabindex="-1" hidden></div></div>`;
}

export function installCertificateWorkflows({
  state,
  openSheet,
  closeSheet,
  openPositionSheet,
  openCardDetail,
  renderCollection,
  renderDetail,
}) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./internal-certificates.css";
  document.head.append(stylesheet);
  let generation = 0;
  let controller = null;
  const saved = new Map();
  const observations = new Map();
  const syntheticOwner = () => state.session?.user?.id === fixtureOwner;
  const cancelPending = () => {
    generation += 1;
    controller?.abort();
    controller = null;
  };

  const remember = (item, record, disposition) => {
    observations.set(item.uid, {
      record: structuredClone(record),
      disposition,
    });
  };
  const attachExisting = (item, record, disposition) => {
    if (!syntheticOwner() || !state.items.includes(item))
      throw new Error("Fixture account changed");
    const active = disposition === "matched";
    if (active && item.gradingCompany !== record.grader)
      throw new Error(
        "Select a copy with the matching grader before attaching",
      );
    const duplicate =
      active &&
      state.items.find(
        (candidate) =>
          candidate !== item &&
          candidate.gradingCompany === record.grader &&
          candidate.certificationNumber === record.certificate &&
          Number(candidate.quantity) > 0,
      );
    if (duplicate)
      throw new Error("That certificate is already attached to an active copy");
    if (active) {
      if (compareCertificate(record, item).length)
        throw new Error("Card facts changed. Review the differences again.");
      item.certificationNumber = record.certificate;
      item.gradeClaimSource = "user";
      item.internalCertificateSample = true;
    }
    remember(item, record, disposition);
    closeSheet({ discardHistory: true });
    renderDetail();
  };

  const saveNew = async (draft, observation) => {
    if (!syntheticOwner()) throw new Error("Fixture account changed");
    if (
      draft.queueEntryKey &&
      (draft.queueOwner !== fixtureOwner ||
        !state.intakeQueue.some((entry) => entry.key === draft.queueEntryKey))
    )
      throw new Error("Queue owner changed");
    const key = draft.idempotencyKey;
    let item = saved.get(key);
    if (!item) {
      const { card, input } = draft;
      const duplicate = state.items.find(
        (candidate) =>
          candidate.gradingCompany === input.grader &&
          candidate.certificationNumber === input.certificationNumber &&
          Number(candidate.quantity) > 0,
      );
      if (duplicate)
        throw new Error(`duplicate_active_certificate:${duplicate.uid}`);
      item = {
        ...card,
        uid: crypto.randomUUID(),
        cardState: "graded",
        gradingCompany: input.grader,
        grade: input.grade,
        gradeQualifier: input.gradeQualifier || "",
        certificationNumber: input.certificationNumber,
        gradeClaimSource: "user",
        quantity: 1,
        status: "owned",
        currency: input.currency || card.currency || "USD",
        cost: draft.acquisitionCostKnown
          ? Number(input.totalAcquisitionCost)
          : null,
        purchaseDate: draft.acquisitionDateKnown ? input.transactionDate : null,
        variant: input.variant || card.variant,
        variantId: input.variantId || card.variantId,
        finish:
          card.variantOptions?.find((option) => option.id === input.variantId)
            ?.finish || card.finish,
        transactions: [],
        lots: [],
        internalCertificateSample: false,
      };
      saved.set(key, item);
      state.items.push(item);
    }
    if (observation) {
      const current = {
        ...item,
        gradingCompany: draft.input.grader,
        grade: draft.input.grade,
        gradeQualifier: draft.input.gradeQualifier,
        certificationNumber: draft.input.certificationNumber,
      };
      const disposition =
        observation.disposition === "matched" &&
        !compareCertificate(observation.record, current).length
          ? "matched"
          : "unresolved";
      remember(item, observation.record, disposition);
      item.internalCertificateSample = disposition === "matched";
    }
    closeSheet({ discardHistory: true });
    renderCollection();
    if (typeof draft.afterSave === "function")
      await draft.afterSave({ itemId: item.uid, refreshPending: false });
    if (!draft.queueEntryKey) openCardDetail(item, true);
  };

  function openLookup(context) {
    cancelPending();
    const ownerAtOpen = state.session?.user?.id;
    const draftForm = context.form;
    const sheet = $("#sheetContent");
    const previous = draftForm ? document.createDocumentFragment() : null;
    if (previous) previous.append(...sheet.childNodes);
    const currentFacts = () =>
      draftForm
        ? {
            ...context.card,
            variant: draftForm.querySelector("#positionVariant")?.value,
            finish:
              context.card.variantOptions?.find(
                (option) =>
                  option.id ===
                  draftForm.querySelector("#positionVariantId")?.value,
              )?.finish || context.card.finish,
            gradingCompany: draftForm.querySelector("#positionGrader")?.value,
            grade: draftForm.querySelector("#positionGrade")?.value,
            gradeQualifier:
              draftForm.querySelector("#positionQualifier")?.value,
            certificationNumber: draftForm.querySelector(
              "#positionCertification",
            )?.value,
          }
        : context.copy;
    const current = currentFacts();
    const initialGrader = current.gradingCompany || "PSA";
    const initialCert = current.certificationNumber || "";
    const returnToCard = () => {
      cancelPending();
      if (previous && state.session?.user?.id === ownerAtOpen) {
        sheet.replaceChildren(previous);
        draftForm.querySelector("#positionCertification")?.focus();
      } else {
        closeSheet({ discardHistory: true });
        if (context.copy) renderDetail();
      }
    };
    openSheet(
      `<div class="sheet-heading"><div><h2 id="sheetTitle">Certificate lookup</h2><p>${esc(current.name || "Current card")} · internal sample</p></div><button class="sheet-close" aria-label="Close">×</button></div><p class="simple-note">Internal sample records. No provider data or authenticity check.</p><form id="certificateLookupForm"><div class="form-grid"><div class="field"><label for="certificateGrader">Grader</label><select id="certificateGrader"><option>PSA</option><option>BGS</option><option>CGC</option><option>SGC</option></select></div><div class="field"><label for="certificateNumber">Certificate number</label><input id="certificateNumber" type="text" maxlength="120" autocomplete="off" required value="${esc(initialCert)}"></div></div><div class="sheet-actions"><button class="primary" type="submit" id="certificateSearch">Look up</button><button class="secondary" type="button" id="certificateCancel">Cancel lookup</button><button class="secondary" type="button" id="certificateBack">Return to card</button></div></form><div id="certificateStatus" role="status" aria-live="polite"></div><div id="certificateOutput"></div>`,
    );
    $("#certificateBack").addEventListener("click", returnToCard);
    if (draftForm)
      $(".sheet-close").addEventListener(
        "click",
        (event) => {
          event.stopImmediatePropagation();
          returnToCard();
        },
        true,
      );
    $("#certificateGrader").value = initialGrader;
    requestAnimationFrame(() => $("#certificateNumber")?.focus());
    const form = $("#certificateLookupForm");
    const status = $("#certificateStatus");
    const output = $("#certificateOutput");
    const stillCurrent = (version) =>
      generation === version &&
      form.isConnected &&
      !$("#bottomSheet").hidden &&
      state.session?.user?.id === ownerAtOpen;
    const clear = () => {
      cancelPending();
      output.replaceChildren();
      status.textContent = "";
      $("#certificateSearch").disabled = false;
    };
    form.addEventListener("input", clear);
    form.addEventListener("change", (event) => {
      if (event.target.id === "certificateGrader") clear();
    });
    $("#certificateCancel").addEventListener("click", () => {
      clear();
      status.textContent = "Lookup canceled. Your input is kept.";
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clear();
      const grader = $("#certificateGrader").value;
      const certificate = $("#certificateNumber").value.trim();
      if (!certificate) {
        status.textContent = "Enter the certificate number.";
        return;
      }
      const version = generation;
      controller = new AbortController();
      $("#certificateSearch").disabled = true;
      status.textContent = "Looking up sample record…";
      try {
        const result = validResult(
          await lookupCertificateFixture({
            grader,
            certificate,
            signal: controller.signal,
          }),
          grader,
          certificate,
        );
        if (!stillCurrent(version)) return;
        if (result.status !== "match") {
          status.textContent = {
            not_found:
              "No sample record found. Check the number and try again.",
            unsupported:
              "This grader or language is not supported in the sample.",
            ambiguous:
              "More than one possible record. Correct the input before attaching.",
          }[result.status];
          return;
        }
        const latest = currentFacts();
        const differences = compareCertificate(result.record, latest);
        output.innerHTML = recordMarkup(result.record, differences, latest);
        status.textContent = "Sample record loaded. Compare it with your card.";
        $("#certificatePopulation").addEventListener("click", () => {
          const panel = $("#certificatePopulationPanel");
          panel.hidden = !panel.hidden;
          panel.innerHTML = panel.hidden
            ? ""
            : `<h3>Population detail</h3>${populationMarkup(result.record)}`;
          if (!panel.hidden) panel.focus();
        });
        const select = (disposition) => {
          if (!stillCurrent(version) || !syntheticOwner()) {
            status.textContent =
              "This sample can only attach to the synthetic fixture account.";
            return;
          }
          cancelPending();
          if (context.copy) {
            try {
              attachExisting(context.copy, result.record, disposition);
            } catch (error) {
              status.textContent = error.message;
            }
          } else {
            draftForm.internalSelectedObservation = {
              record: result.record,
              disposition,
            };
            returnToCard();
            if (disposition === "matched") {
              const set = (id, value) => {
                const field = draftForm.querySelector(id);
                if (field && !field.value && value != null) field.value = value;
              };
              const stateField = draftForm.querySelector("#positionState");
              if (stateField.value !== "graded") {
                stateField.value = "graded";
                stateField.dispatchEvent(
                  new Event("change", { bubbles: true }),
                );
              }
              set("#positionGrader", result.record.grader);
              set("#positionGrade", result.record.grade);
              set("#positionQualifier", result.record.qualifier);
              set("#positionCertification", result.record.certificate);
            }
          }
        };
        $("#certificateContinue")?.addEventListener("click", () =>
          select("matched"),
        );
        $("#certificateReturn")?.addEventListener("click", returnToCard);
        $("#certificateUnresolved")?.addEventListener("click", () =>
          select("unresolved"),
        );
      } catch (error) {
        if (!stillCurrent(version) || error.name === "AbortError") return;
        status.textContent =
          {
            offline: "Offline. Your input is kept; retry when connected.",
            rate_limit: "Sample rate limit. Your input is kept; retry shortly.",
            entitlement: "Lookup access unavailable. Your input is kept.",
            malformed:
              "Sample response incomplete. Nothing was attached; retry.",
            unavailable: "Lookup unavailable. Your input is kept; retry.",
          }[error.message] || "Lookup unavailable. Your input is kept; retry.";
      } finally {
        if (stillCurrent(version)) $("#certificateSearch").disabled = false;
      }
    });
  }

  let scheduled = false;
  const addEntries = () => {
    scheduled = false;
    const form = $("#positionForm");
    if (form?.internalCertificateCard && !$("#certificateLookupFromAdd")) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "certificateLookupFromAdd";
      button.className = "secondary";
      button.textContent = "Look up certificate sample";
      form.querySelector(".sheet-actions")?.append(button);
      form.internalFixtureSave = (draft) =>
        saveNew(draft, form.internalSelectedObservation);
      button.addEventListener("click", () =>
        openLookup({ card: form.internalCertificateCard, form }),
      );
    }
    const copy = state.items.find((item) => item.uid === state.detailId);
    const actions = $(".owned-actions");
    if (
      copy?.cardState === "graded" &&
      actions &&
      !$("#certificateLookupFromCopy")
    ) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "certificateLookupFromCopy";
      button.textContent = "Certificate lookup sample";
      actions.append(button);
      button.addEventListener("click", () => openLookup({ copy }));
    }
    const observation = copy && observations.get(copy.uid);
    if (observation && actions && !$("#certificateObservationDetails")) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "certificateObservationDetails";
      button.textContent = "View certificate sample";
      actions.append(button);
      button.addEventListener("click", () => {
        const selected = observations.get(copy.uid);
        if (!selected || !syntheticOwner()) return;
        const record = selected.record;
        openSheet(
          `<div class="sheet-heading"><div><h2 id="sheetTitle">Certificate sample observation</h2><p>Internal fixture · ${esc(selected.disposition)}</p></div><button class="sheet-close" aria-label="Close">×</button></div>${recordMarkup(record, compareCertificate(record, copy), copy).replace(/<div class="sheet-actions">[\s\S]*?<div id="certificatePopulationPanel" tabindex="-1" hidden><\/div>/, "")}<h3>Population snapshot</h3>${populationMarkup(record)}<p>Source: ${shown(record.source)} · Observed: ${shown(record.observedAt)} · ${selected.disposition === "matched" ? "Matched user claim" : "Unresolved; active certificate unchanged"}</p>`,
        );
      });
    }
    if (!$("#certificateInternalBadge") && $("#appShell")) {
      const badge = document.createElement("div");
      badge.id = "certificateInternalBadge";
      badge.innerHTML =
        '<small>Internal certificate samples · no provider connection</small> <button type="button" id="certificateInternalStart">Try certificate workflow</button>';
      $("#appShell").prepend(badge);
      $("#certificateInternalStart").addEventListener("click", () =>
        openPositionSheet({
          id: "synthetic-pikachu",
          name: "Pikachu",
          set: "Synthetic Violet",
          number: "025/165",
          variant: "Normal",
          language: "en",
          cardState: "raw",
        }),
      );
    }
  };
  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(addEntries);
    }
    if (!$("#certificateLookupForm") || $("#bottomSheet")?.hidden)
      cancelPending();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });
  if (!state.session) {
    state.session = { user: { id: fixtureOwner } };
    state.accountLoading = false;
    state.items = [];
    document.body.classList.add("authenticated");
    $("#authGate").hidden = true;
    $("#appShell").removeAttribute("aria-hidden");
  }
  addEntries();
}
