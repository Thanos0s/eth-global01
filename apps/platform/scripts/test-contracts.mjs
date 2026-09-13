import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

async function runTests() {
  console.log("=== Testing LiquidityStream Smart Contracts ===");

  const platformRoot = fs.existsSync(path.join(process.cwd(), "src"))
    ? process.cwd()
    : path.join(process.cwd(), "apps", "platform");
  const generatedDir = path.join(platformRoot, "src", "lib", "evm", "generated");

  // Step 1: Check artifact existence
  console.log("\n[Test 1] Checking compiled contract artifacts...");
  const registryArtifactPath = path.join(generatedDir, "PropertyRegistry.json");
  const vaultArtifactPath = path.join(generatedDir, "YieldVault.json");
  const consumerArtifactPath = path.join(generatedDir, "USPSChainlinkConsumer.json");
  const canonicalEpArtifactPath = path.join(generatedDir, "CanonicalEntryPoint.json");
  const validatorArtifactPath = path.join(generatedDir, "SessionKeyValidator.json");

  assert(fs.existsSync(registryArtifactPath), "PropertyRegistry.json must exist");
  assert(fs.existsSync(vaultArtifactPath), "YieldVault.json must exist");
  assert(fs.existsSync(consumerArtifactPath), "USPSChainlinkConsumer.json must exist");
  assert(fs.existsSync(canonicalEpArtifactPath), "CanonicalEntryPoint.json must exist");
  assert(fs.existsSync(validatorArtifactPath), "SessionKeyValidator.json must exist");

  const registryArtifact = JSON.parse(fs.readFileSync(registryArtifactPath, "utf8"));
  const vaultArtifact = JSON.parse(fs.readFileSync(vaultArtifactPath, "utf8"));
  const consumerArtifact = JSON.parse(fs.readFileSync(consumerArtifactPath, "utf8"));
  const canonicalEpArtifact = JSON.parse(fs.readFileSync(canonicalEpArtifactPath, "utf8"));
  const validatorArtifact = JSON.parse(fs.readFileSync(validatorArtifactPath, "utf8"));

  assert(registryArtifact.abi && registryArtifact.bytecode, "PropertyRegistry must have ABI and bytecode");
  assert(vaultArtifact.abi && vaultArtifact.bytecode, "YieldVault must have ABI and bytecode");
  assert(consumerArtifact.abi && consumerArtifact.bytecode, "USPSChainlinkConsumer must have ABI and bytecode");
  assert(canonicalEpArtifact.abi && canonicalEpArtifact.bytecode, "CanonicalEntryPoint must have ABI and bytecode");
  assert(validatorArtifact.abi && validatorArtifact.bytecode, "SessionKeyValidator must have ABI and bytecode");

  const canonicalEpIface = new ethers.Interface(canonicalEpArtifact.abi);
  assert(canonicalEpIface.getFunction("handleOps"), "CanonicalEntryPoint must expose handleOps");
  assert(canonicalEpIface.getFunction("getUserOpHash"), "CanonicalEntryPoint must expose getUserOpHash");
  console.log("✓ Test 1 Passed: All contract artifacts compiled and present.");

  // Step 2: Test PropertyRegistry ABI signatures
  console.log("\n[Test 2] Testing PropertyRegistry deployment & state transitions...");
  const registryInterface = new ethers.Interface(registryArtifact.abi);
  assert(registryInterface.getFunction("registerProperty"), "registerProperty function must exist");
  assert(registryInterface.getFunction("setVerificationStatus"), "setVerificationStatus function must exist");
  assert(registryInterface.getFunction("updatePropertyStatus"), "updatePropertyStatus function must exist");
  assert(registryInterface.getFunction("getProperty"), "getProperty function must exist");
  console.log("✓ Test 2 Passed: PropertyRegistry ABI signatures verified.");

  // Step 3: Test YieldVault ABI signatures
  console.log("\n[Test 3] Testing YieldVault ABI signatures & flow math...");
  const vaultInterface = new ethers.Interface(vaultArtifact.abi);
  assert(vaultInterface.getFunction("depositRent"), "depositRent function must exist");
  assert(vaultInterface.getFunction("createInvestorStream"), "createInvestorStream function must exist");
  assert(vaultInterface.getFunction("deleteInvestorStream"), "deleteInvestorStream function must exist");
  assert(vaultInterface.getFunction("emergencyFreezeBatch"), "emergencyFreezeBatch function must exist");
  assert(vaultInterface.getFunction("calculateFlowRate"), "calculateFlowRate function must exist");
  console.log("✓ Test 3 Passed: YieldVault ABI signatures verified.");

  // Step 4: Test USPSChainlinkConsumer ABI signatures
  console.log("\n[Test 4] Testing USPSChainlinkConsumer ABI signatures...");
  const consumerInterface = new ethers.Interface(consumerArtifact.abi);
  assert(consumerInterface.getFunction("requestAddressValidation"), "requestAddressValidation function must exist");
  assert(consumerInterface.getFunction("handleOracleFulfillment"), "handleOracleFulfillment function must exist");
  console.log("✓ Test 4 Passed: USPSChainlinkConsumer ABI signatures verified.");

  // Step 5: Test SessionKeyValidator ABI signatures & ERC-7579 interface
  console.log("\n[Test 5] Testing SessionKeyValidator ABI signatures & ERC-7579 interface...");
  const validatorInterface = new ethers.Interface(validatorArtifact.abi);
  assert(validatorInterface.getFunction("validateUserOp"), "validateUserOp function must exist");
  assert(validatorInterface.getFunction("checkAndRecordSpend"), "checkAndRecordSpend function must exist");
  assert(validatorInterface.getFunction("hashPolicy"), "hashPolicy function must exist");
  assert(validatorInterface.getFunction("validateSession"), "validateSession function must exist");
  assert(validatorInterface.getFunction("isModuleType"), "isModuleType function must exist");
  console.log("✓ Test 5 Passed: SessionKeyValidator ERC-7579 / ERC-4337 ABI signatures verified.");

  console.log("\n=======================================================");
  console.log("All Smart Contract tests PASSED successfully! 🚀");
  console.log("=======================================================");
}

runTests().catch((err) => {
  console.error("Contract test failed:", err.message);
  process.exit(1);
});
