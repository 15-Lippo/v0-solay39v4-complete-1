// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AuditRegistry.sol";
import "../contracts/Solay39EnterpriseRegistry.sol";

contract EventsAndStateTest is Test {
    AuditRegistry private registry;
    Solay39EnterpriseRegistry private enterprise;

    function setUp() public {
        registry = new AuditRegistry();
        enterprise = new Solay39EnterpriseRegistry();
    }

    function testAuditRegistrationEventAndState() public {
        bytes32 reportHash = keccak256("report");
        vm.expectEmit(true, true, true, true, address(registry));
        emit AuditRegistry.AuditRegistered("audit-1", reportHash, address(0x123), address(this), 95, "cid", block.timestamp);
        registry.registerAudit("audit-1", reportHash, keccak256("code"), address(0x123), 95, "cid");

        assertEq(registry.totalAudits(), 1);
        assertEq(registry.hashToAuditId(reportHash), "audit-1");
    }

    function testInvalidationEventUpdatesState() public {
        bytes32 reportHash = keccak256("report");
        registry.registerAuditAuto(reportHash, keccak256("code"), address(0), 70, "cid");
        (,, string memory auditId,,,,) = registry.verifyByHash(reportHash);

        vm.expectEmit(true, true, false, true, address(registry));
        emit AuditRegistry.AuditInvalidated(auditId, address(this), "withdrawn");
        registry.invalidateAudit(auditId, "withdrawn");

        (bool exists, bool valid,,,,,,) = registry.verifyById(auditId);
        assertTrue(exists);
        assertFalse(valid);
    }

    function testEnterprisePublishEventAndCount() public {
        address[] memory auditors = new address[](1);
        auditors[0] = address(0x123);
        vm.expectEmit(true, false, false, true, address(enterprise));
        emit Solay39EnterpriseRegistry.AuditPublished(bytes32(0), "Project");
        enterprise.publishAudit("Project", "report", "commit", auditors);
        assertEq(enterprise.getAuditCount(), 1);
    }
}
Content omitted for brevity? no, actual content needed.
