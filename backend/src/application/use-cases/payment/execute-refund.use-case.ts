import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import type { IRefundPolicyRepository } from '../../../domain/repositories/refund-policy-repository.interface.js';
import { REFUND_POLICY_REPOSITORY } from '../../../domain/repositories/refund-policy-repository.interface.js';
import type { ILedgerRepository } from '../../../domain/repositories/ledger-repository.interface.js';
import { LEDGER_REPOSITORY } from '../../../domain/repositories/ledger-repository.interface.js';
import type { IPaymentProvider } from '../../../domain/repositories/payment-provider.interface.js';
import { PAYMENT_PROVIDER } from '../../../domain/repositories/payment-provider.interface.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface.js';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface.js';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface.js';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface.js';
import { RefundCalculator } from '../../../domain/services/refund-calculator.js';
import { PaymentOrderStatus, LedgerEntryType } from '../../../domain/entities/payment-order.js';
import type { ExecuteRefundDto } from '../../dto/payment/execute-refund.dto.js';
import { NOTIFICATION_EVENTS } from '../../notification/notification-context.types.js';

@Injectable()
export class ExecuteRefundUseCase {
  private readonly logger = new Logger(ExecuteRefundUseCase.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    @Inject(REFUND_POLICY_REPOSITORY)
    private readonly policyRepo: IRefundPolicyRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepo: ILedgerRepository,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: IPaymentProvider,
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(dto: ExecuteRefundDto, recordedBy: number) {
    // 1. Load order
    const order = await this.orderRepo.findById(dto.orderId);
    if (!order) {
      throw new NotFoundException('Payment order not found');
    }

    if (!['DONE', 'PARTIAL_CANCELED'].includes(order.status)) {
      throw new UnprocessableEntityException(
        `Order status '${order.status}' is not eligible for refund`,
      );
    }

    if (!order.pgPaymentKey) {
      throw new UnprocessableEntityException('Order has no payment key');
    }

    // 2. Calculate refund
    const policy = await this.policyRepo.findByIdWithTiers(order.refundPolicyId);
    if (!policy || policy.tiers.length === 0) {
      throw new Error('Refund policy or tiers not found');
    }

    const calc = RefundCalculator.calculate(
      order.amount,
      dto.heldSessionCount,
      dto.totalSessionCount,
      policy.tiers,
    );

    // Allow admin override but not above calculated amount
    const refundAmount = dto.overrideAmount != null
      ? Math.min(dto.overrideAmount, calc.refundAmount)
      : calc.refundAmount;

    if (refundAmount <= 0) {
      throw new UnprocessableEntityException(
        'Refund amount is 0 — elapsed ratio exceeds refund threshold (1/2 경과 후 환불 불가)',
      );
    }

    // 3. Call Toss Cancel API
    this.logger.log(
      `Executing refund: order=${order.id}, amount=${refundAmount}`,
    );

    const isFullCancel = refundAmount >= order.amount;
    const tossResult = await this.paymentProvider.cancel({
      paymentKey: order.pgPaymentKey,
      cancelReason: dto.cancelReason,
      cancelAmount: isFullCancel ? undefined : refundAmount,
    });

    // 4. Update order status
    const newStatus = isFullCancel
      ? PaymentOrderStatus.CANCELED
      : PaymentOrderStatus.PARTIAL_CANCELED;

    const updatedOrder = await this.orderRepo.updateStatus(order.id, newStatus, {
      canceledAt: new Date(),
    });

    // 5. Create ledger entry (negative amount for refund)
    await this.ledgerRepo.create({
      orderId: order.id,
      entryType: LedgerEntryType.REFUND,
      amount: -refundAmount,
      balanceAfter: order.amount - refundAmount,
      refundTierId: calc.matchedTier.id,
      elapsedRatioAtRefund: calc.elapsedRatio,
      memo: dto.cancelReason,
      recordedBy,
    });

    this.logger.log(
      `Refund completed: order=${order.id}, status=${newStatus}, amount=${refundAmount}`,
    );

    // C-NTF-01: best-effort notification
    try {
      const phone = await this.resolveParentPhone(updatedOrder.enrollmentId);
      if (phone) {
        this.events.emit(NOTIFICATION_EVENTS.RefundDone, {
          academyId: updatedOrder.academyId,
          recipients: [phone],
          recipientKind: 'PARENT',
          subjectId: updatedOrder.id,
          subjectKind: 'PAYMENT_ORDER',
          variables: {
            orderNo: updatedOrder.orderNo ?? '',
            refundAmount: String(refundAmount),
            cancelReason: dto.cancelReason ?? '',
            studentName: updatedOrder.studentName ?? '',
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to emit REFUND_DONE event: ${(err as Error).message}`,
      );
    }

    return {
      orderId: updatedOrder.id,
      orderNo: updatedOrder.orderNo,
      status: newStatus,
      refundAmount,
      elapsedRatio: calc.elapsedRatio,
      tierNote: calc.matchedTier.note,
      tossStatus: tossResult.status,
    };
  }

  private async resolveParentPhone(enrollmentId: number): Promise<string | null> {
    const enr = await this.enrollmentRepo.findById(enrollmentId);
    if (!enr) return null;
    const parentId = enr.appliedParentId ?? null;
    if (!parentId) {
      const student = await this.studentRepo.findById(enr.studentId);
      const pid = student?.primaryParentId;
      if (!pid) return null;
      const p = await this.parentRepo.findById(pid);
      return p?.phone ?? null;
    }
    const parent = await this.parentRepo.findById(parentId);
    return parent?.phone ?? null;
  }
}
