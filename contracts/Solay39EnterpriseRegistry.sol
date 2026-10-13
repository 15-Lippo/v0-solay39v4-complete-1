// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Solay39EnterpriseRegistry {
    struct Audit { string project; string reportHash; string commitHash; address[] auditors; uint256 timestamp; }
    mapping(bytes32 => Audit) public audits;
    bytes32[] private _auditIds;
    uint256 public auditNonce;

    event AuditPublished(bytes32 indexed id, string project);

    function publishAudit(string memory project, string memory reportHash, string memory commitHash, address[] memory auditors) public returns (bytes32 id) {
        id = keccak256(abi.encodePacked(project, reportHash, commitHash, msg.sender, block.number, block.timestamp, auditNonce));
        auditNonce++;
        require(audits[id].timestamp == 0, "Audit ID exists");
        audits[id] = Audit({project: project, reportHash: reportHash, commitHash: commitHash, auditors: auditors, timestamp: block.timestamp});
        _auditIds.push(id);
        emit AuditPublished(id, project);
    }

    function verifyAudit(bytes32 id) external view returns (string memory project, string memory reportHash, string memory commitHash, address[] memory auditors, uint256 timestamp) {
        Audit storage a = audits[id];
        require(a.timestamp > 0, "Audit not found");
        return (a.project, a.reportHash, a.commitHash, a.auditors, a.timestamp);
    }

    function getAuditCount() external view returns (uint256) { return _auditIds.length; }
    function getAllAuditIds() external view returns (bytes32[] memory) { return _auditIds; }
}
