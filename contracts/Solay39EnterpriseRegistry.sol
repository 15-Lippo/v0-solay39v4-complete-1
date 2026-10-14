// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Solay39EnterpriseRegistry {
    struct Audit { string project; string reportHash; string commitHash; address[] auditors; uint256 timestamp; }
    mapping(bytes32 => Audit) public audits;
    bytes32[] private _auditIds;
    uint256 public auditNonce;
    error AuditNotFound();
    event AuditPublished(bytes32 indexed id, string project);

    function publishAudit(string memory project, string memory reportHash, string memory commitHash, address[] memory auditors) public returns (bytes32 id) {
        id = keccak256(abi.encodePacked(project, reportHash, commitHash, msg.sender, block.number, block.timestamp, auditNonce));
        auditNonce++;
        audits[id] = Audit(project, reportHash, commitHash, auditors, block.timestamp);
        _auditIds.push(id);
        emit AuditPublished(id, project);
    }

    function verifyAudit(bytes32 id) external view returns (string memory, string memory, string memory, address[] memory, uint256) {
        Audit storage a = audits[id];
        if (a.timestamp == 0) revert AuditNotFound();
        return (a.project, a.reportHash, a.commitHash, a.auditors, a.timestamp);
    }
    function verifyByReportHash(string calldata reportHash) external view returns (bool found, bytes32 id) {
        bytes32 needle = keccak256(bytes(reportHash));
        for (uint256 i; i < _auditIds.length; i++) {
            bytes32 candidate = _auditIds[i];
            if (keccak256(bytes(audits[candidate].reportHash)) == needle) return (true, candidate);
        }
        return (false, bytes32(0));
    }
    function getAuditCount() external view returns (uint256) { return _auditIds.length; }
    function getAllAuditIds() external view returns (bytes32[] memory) { return _auditIds; }
}
