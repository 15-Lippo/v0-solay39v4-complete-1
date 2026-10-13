// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Solay39AuditRegistry {
    struct AuditRecord { string projectName; string reportHash; string codeReference; string ipfsCid; uint8 score; address auditor; uint256 timestamp; bool valid; }
    address public immutable owner;
    uint256 public totalAudits;
    uint256 public auditNonce;
    mapping(bytes32 => AuditRecord) private _audits;
    mapping(string => bytes32) private _hashToId;
    bytes32[] private _auditIds;

    event AuditRegistered(bytes32 indexed auditId, string projectName, string reportHash, string ipfsCid, uint8 score, address auditor, uint256 timestamp);
    event AuditInvalidated(bytes32 indexed auditId, string reason);
    error OnlyOwner(); error AuditAlreadyExists(); error AuditNotFound(); error HashAlreadyRegistered(); error InvalidScore(); error EmptyField();

    constructor() { owner = msg.sender; }
    modifier onlyOwner() { if (msg.sender != owner) revert OnlyOwner(); _; }

    function registerAudit(string calldata projectName, string calldata reportHash, string calldata codeReference, string calldata ipfsCid, uint8 score) external onlyOwner returns (bytes32 auditId) {
        if (bytes(projectName).length == 0 || bytes(reportHash).length == 0) revert EmptyField();
        if (score > 100) revert InvalidScore();
        if (_hashToId[reportHash] != bytes32(0)) revert HashAlreadyRegistered();
        auditId = keccak256(abi.encodePacked(projectName, reportHash, block.timestamp, msg.sender, block.number, auditNonce));
        auditNonce++;
        if (_audits[auditId].timestamp != 0) revert AuditAlreadyExists();
        _audits[auditId] = AuditRecord(projectName, reportHash, codeReference, ipfsCid, score, msg.sender, block.timestamp, true);
        _hashToId[reportHash] = auditId; _auditIds.push(auditId); totalAudits++;
        emit AuditRegistered(auditId, projectName, reportHash, ipfsCid, score, msg.sender, block.timestamp);
    }

    function invalidateAudit(bytes32 auditId, string calldata reason) external onlyOwner { if (_audits[auditId].timestamp == 0) revert AuditNotFound(); _audits[auditId].valid = false; emit AuditInvalidated(auditId, reason); }
    function getAllAuditIds() external view returns (bytes32[] memory) { return _auditIds; }
}
