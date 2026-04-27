import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import type { IPaymentProvider } from '../../../domain/repositories/payment-provider.interface.js';
import { PAYMENT_PROVIDER } from '../../../domain/repositories/payment-provider.interface.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface.js';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface.js';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface.js';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface.js';
import type { ConfirmPaymentDto } from '../../dto/payment/index.js';
import { PaymentOrderResponseDto } from '../../dto/payment/index.js';
import { PaymentOrder } from '../../../domain/entities/payment-order.js';
import { NOTIFICATION_EVENTS } from '../../notification/notification-context.types.js';

@Injectable()
export class ConfirmPaymentUseCase {
  private readonly logger = new Logger(ConfirmPaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: IPaymentOrderRepository,
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

  async execute(dto: ConfirmPaymentDto): Promise<PaymentOrderResponseDto> {
    // Find order by orderId (= orderNo)
    const order = await this.paymentOrderRepo.findByOrderNo(dto.orderId);
    if (!order) {
      throw new NotFoundException(`Order not found: ${dto.orderId}`);
    }

    // Validate order state
    if (order.status !== 'READY' && order.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot confirm order in status: ${order.status}`,
      );
    }

    // Validate amount matches
    if (order.amount !== dto.amount) {
      this.logger.error(
        `Amount mismatch: order=${order.amount}, request=${dto.amount}`,
      );
      throw new BadRequestException('Amount mismatch — potential tampering');
    }

    // Call Toss Payments Confirm API
    const tossResult = await this.paymentProvider.confirm({
      paymentKey: dto.paymentKey,
      orderId: dto.orderId,
      amount: dto.amount,
    });

    // Update order with Toss response
    const updated = await this.paymentOrderRepo.updateStatus(order.id, 'DONE', {
      pgPaymentKey: tossResult.paymentKey,
      method: tossResult.method,
      approvedAt: new Date(tossResult.approvedAt),
    });

    this.logger.log(
      `Payment confirmed: orderNo=${order.orderNo}, paymentKey=${tossResult.paymentKey}`,
    );

    // C-NTF-01: best-effort notification
    try {
      const phone = await this.resolveParentPhone(updated.enrollmentId);
      if (phone) {
        this.events.emit(NOTIFICATION_EVENTS.PaymentDone, {
          academyId: updated.academyId,
          recipients: [phone],
          recipientKind: 'PARENT',
          subjectId: updated.id,
          subjectKind: 'PAYMENT_ORDER',
          variables: {
            orderNo: updated.orderNo ?? '',
            amount: String(updated.amount ?? 0),
            studentName: updated.studentName ?? '',
            programName: updated.programName ?? '',
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to emit PAYMENT_DONE event: ${(err as Error).message}`,
      );
    }

    return this.toResponse(updated);
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

  private toResponse(o: PaymentOrder): PaymentOrderResponseDto {
    const dto = new PaymentOrderResponseDto();
    dto.id = o.id;
    dto.orderNo = o.orderNo;
    dto.enrollmentId = o.enrollmentId;
    dto.amount = o.amount;
    dto.currency = o.currency;
    dto.method = o.method;
    dto.pgProvider = o.pgProvider;
    dto.pgPaymentKey = o.pgPaymentKey;
    dto.status = o.status;
    dto.approvedAt = o.approvedAt?.toISOString() ?? null;
    dto.canceledAt = o.canceledAt?.toISOString() ?? null;
    dto.createdAt = o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt);
    dto.studentName = o.studentName ?? null;
    dto.parentName = o.parentName ?? null;
    dto.programName = o.programName ?? null;
    dto.className = o.className ?? null;
    return dto;
  }
}
