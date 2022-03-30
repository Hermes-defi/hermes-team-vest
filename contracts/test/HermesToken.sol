pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HermesToken is ERC20 {
    constructor () ERC20("HMT", "HermesToken") {
        _mint(msg.sender, 10**30);
    }
}
