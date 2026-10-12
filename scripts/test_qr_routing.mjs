// Test script to verify URL query param logic and occupant routing logic
import assert from "node:assert";

// Simulation of OccupantPortal viewState determination
function determineViewState(searchParamsString, mockLocalStorage = {}) {
  const params = new URLSearchParams(searchParamsString);
  const isForceNew =
    params.get("force_new") === "1" ||
    params.get("register") === "1" ||
    params.get("new") === "1";

  if (isForceNew) {
    return "newcomer-signin";
  }

  const hasExplicitId = Boolean(
    params.get("id") || params.get("badge") || params.get("user") || params.get("occupantId")
  );
  const stored =
    mockLocalStorage["muster_registered_occupant_id"] ||
    mockLocalStorage["muster_occupant_id"];

  if (hasExplicitId || stored) {
    return "confirmed";
  }

  return "newcomer-signin";
}

console.log("Running 5G QR Code Routing & Evacuation Map Logic Tests...\n");

// Scenario 1: Newcomer scans 5G QR poster (?scan=1&mode=signin) with empty device storage
const res1 = determineViewState("?scan=1&mode=signin", {});
assert.strictEqual(res1, "newcomer-signin", "Newcomer without stored pass must land on newcomer-signin");
console.log("✓ Test 1 Passed: Newcomer with clean phone storage lands on 'newcomer-signin' form.");

// Scenario 2: Returning occupant scans 5G QR poster (?scan=1&mode=signin) who has previously signed in
const res2 = determineViewState("?scan=1&mode=signin", {
  muster_registered_occupant_id: "OCC-102",
  muster_registered_name: "Samuel McFarlane"
});
assert.strictEqual(res2, "confirmed", "Returning occupant with stored pass must land on confirmed procedure & map");
console.log("✓ Test 2 Passed: Returning occupant with stored pass lands directly on 'confirmed' pass & evacuation procedures.");

// Scenario 3: Occupant scans their personalized badge QR code with ?id=OCC-101
const res3 = determineViewState("?id=OCC-101&mode=signin", {});
assert.strictEqual(res3, "confirmed", "Explicit badge scan must land on confirmed pass");
console.log("✓ Test 3 Passed: Explicit badge scan with ?id= lands directly on 'confirmed' pass.");

// Scenario 4: User explicitly clicks 'Register New Person' (?force_new=1) even with stored pass
const res4 = determineViewState("?scan=1&mode=signin&force_new=1", {
  muster_registered_occupant_id: "OCC-102"
});
assert.strictEqual(res4, "newcomer-signin", "Explicit force_new must route to newcomer signin");
console.log("✓ Test 4 Passed: Explicit force_new override routes to newcomer-signin.");

console.log("\nAll 4 5G QR code routing tests PASSED successfully!");
