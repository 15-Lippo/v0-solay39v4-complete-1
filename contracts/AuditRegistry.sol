// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AuditRegistry {
    struct AuditRecord { bytes32 reportHash; bytes32 codeHash; address auditedContract; address auditor; uint256 timestamp; uint8 score; string ipfsCid; string auditId; bool isValid; }
    struct AuditorProfile { string name; string firmName; uint256 totalAudits; uint256 registeredAt; bool isVerified; }
    address public owner;
    mapping(string => AuditRecord) public audits;
    mapping(bytes32 => string) public hashToAuditId;
    mapping(address => string[]) public contractAudits;
    mapping(address => AuditorProfile) public auditors;
    mapping(address => string[]) public auditorAudits;
    uint256 public totalAudits;
    uint256 public auditNonce;
    mapping(address => bool) public verifiedAuditors;
    event AuditRegistered(string indexed auditId, bytes32 indexed reportHash, address indexed auditedContract, address auditor, uint8 score, string ipfsCid, uint256 timestamp);
    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }
    modifier onlyVerifiedAuditor() { require(verifiedAuditors[msg.sender] || msg.sender == owner, "Not verified auditor"); _; }
    constructor() { owner = msg.sender; verifiedAuditors[msg.sender] = true; auditors[msg.sender] = AuditorProfile("Solay39 Official", "Solay39 Security", 0, block.timestamp, true); }

    function registerAuditAuto(bytes32 reportHash, bytes32 codeHash, address auditedContract, uint8 score, string calldata ipfsCid) external onlyVerifiedAuditor {
        require(reportHash != bytes32(0), "Empty report hash"); require(score <= 100, "Score > 100"); require(bytes(hashToAuditId[reportHash]).length == 0, "Report hash exists");
        bytes32 raw = keccak256(abi.encodePacked(msg.sender, reportHash, codeHash, block.number, block.timestamp, auditNonce)); auditNonce++;
        string memory auditId = _toHexString(raw); require(audits[auditId].timestamp == 0, "Audit ID exists");
        audits[auditId] = AuditRecord(reportHash, codeHash, auditedContract, msg.sender, block.timestamp, score, ipfsCid, auditId, true);
        hashToAuditId[reportHash] = auditId; if (auditedContract != address(0)) contractAudits[auditedContract].push(auditId); auditorAudits[msg.sender].push(auditId); auditors[msg.sender].totalAudits++; totalAudits++;
        emit AuditRegistered(auditId, reportHash, auditedContract, msg.sender, score, ipfsCid, block.timestamp);
    }
    function _toHexString(bytes32 data) internal pure returns (string memory) { bytes memory alphabet = "0123456789abcdef"; bytes memory str = new bytes(64); for (uint i; i < 32; i++) { str[i*2] = alphabet[uint8(data[i] >> 4)]; str[i*2+1] = alphabet[uint8(data[i] & 0x0f)]; } return string(str); }
}
