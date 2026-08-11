# PACT local verify (PowerShell)
# Prerequisites: anvil running, contracts deployed, DemoTravelBot broadcast

$ErrorActionPreference = "Stop"
$RPC = "http://127.0.0.1:8545"
$VAULT = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
$REGISTRY = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
$POLICY = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
$FLIGHT = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"
$USDC = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
$OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

Write-Host "Vault balance:" (cast call $VAULT "balances(address)(uint256)" $OWNER --rpc-url $RPC)
Write-Host "Agent id:" (cast call $REGISTRY "agentIdByAddress(address)(uint256)" $OWNER --rpc-url $RPC)
Write-Host "Flight purchases:" (cast call $FLIGHT "purchaseCount()(uint256)" --rpc-url $RPC)
Write-Host "Simulate `$80:" (cast call $POLICY "simulate(uint256,address,bytes4,address,uint256)(bool,string)" 1 $FLIGHT 0xd63c2bd6 $USDC 80000000 --rpc-url $RPC)
