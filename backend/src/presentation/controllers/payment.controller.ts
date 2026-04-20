import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreatePaymentOrderDto, ConfirmPaymentDto, CalculateRefundDto, ExecuteRefundDto, CreateTaxInvoiceDto } from '../../application/dto/payment/index.js';
import { CreateRefundPolicyDto } from '../../application/dto/payment/create-refund-policy.dto.js';
import {
  CreatePaymentOrderUseCase,
  ConfirmPaymentUseCase,
  GetPaymentOrdersUseCase,
  CalculateRefundUseCase,
  ExecuteRefundUseCase,
  CreateTaxInvoiceUseCase,
  SubmitTaxInvoiceUseCase,
  GetTaxInvoicesUseCase,
} from '../../application/use-cases/payment/index.js';
import { ManageRefundPolicyUseCase } from '../../application/use-cases/payment/manage-refund-policy.use-case.js';
import { GetReceiptsUseCase } from '../../application/use-cases/payment/get-receipts.use-case.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly getPaymentOrders: GetPaymentOrdersUseCase,
    private readonly createPaymentOrder: CreatePaymentOrderUseCase,
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly calculateRefund: CalculateRefundUseCase,
    private readonly executeRefund: ExecuteRefundUseCase,
    private readonly createTaxInvoice: CreateTaxInvoiceUseCase,
    private readonly submitTaxInvoice: SubmitTaxInvoiceUseCase,
    private readonly getTaxInvoices: GetTaxInvoicesUseCase,
    private readonly manageRefundPolicy: ManageRefundPolicyUseCase,
    private readonly getReceipts: GetReceiptsUseCase,
  ) {}

  @Get('orders')
  @ApiOperation({ summary: 'Get payment order list (결제 주문 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'enrollmentId', required: false })
  @ApiQuery({ name: 'method', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async listOrders(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('enrollmentId') enrollmentId?: string,
    @Query('method') method?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.getPaymentOrders.execute(user.academyId, {
      status,
      enrollmentId: enrollmentId ? parseInt(enrollmentId, 10) : undefined,
      method,
      dateFrom,
      dateTo,
    });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get payment order detail (결제 주문 상세)' })
  async getOrder(@Param('id', ParseIntPipe) id: number) {
    const order = await this.getPaymentOrders.executeById(id);
    if (!order) {
      throw new NotFoundException('Payment order not found');
    }
    return order;
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create payment order (결제 주문 생성)' })
  async createOrder(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return this.createPaymentOrder.execute(user.academyId, dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm payment with Toss (결제 승인)' })
  async confirm(@Body() dto: ConfirmPaymentDto) {
    return this.confirmPayment.execute(dto);
  }

  @Post('refund/calculate')
  @ApiOperation({ summary: 'Calculate refund amount (환불 계산 미리보기)' })
  async calcRefund(@Body() dto: CalculateRefundDto) {
    return this.calculateRefund.execute(dto);
  }

  @Post('refund/execute')
  @ApiOperation({ summary: 'Execute refund via Toss Cancel (환불 실행)' })
  async execRefund(
    @CurrentUser() user: { userId: number },
    @Body() dto: ExecuteRefundDto,
  ) {
    return this.executeRefund.execute(dto, user.userId);
  }

  // --- Tax Invoice Endpoints ---

  @Get('tax-invoices')
  @ApiOperation({ summary: 'Get tax invoice list (세금계산서 목록)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async listTaxInvoices(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.getTaxInvoices.execute(user.academyId, { status, dateFrom, dateTo });
  }

  @Get('tax-invoices/:id')
  @ApiOperation({ summary: 'Get tax invoice detail (세금계산서 상세)' })
  async getTaxInvoice(@Param('id', ParseIntPipe) id: number) {
    const invoice = await this.getTaxInvoices.executeById(id);
    if (!invoice) {
      throw new NotFoundException('Tax invoice not found');
    }
    return invoice;
  }

  @Post('tax-invoices')
  @ApiOperation({ summary: 'Create tax invoice draft (세금계산서 초안 생성)' })
  async createTaxInv(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateTaxInvoiceDto,
  ) {
    return this.createTaxInvoice.execute(user.academyId, dto);
  }

  @Post('tax-invoices/:id/submit')
  @ApiOperation({ summary: 'Submit tax invoice to NTS (국세청 제출)' })
  async submitTaxInv(@Param('id', ParseIntPipe) id: number) {
    return this.submitTaxInvoice.execute(id);
  }

  // --- Refund Policy Endpoints ---

  @Get('refund-policies')
  @ApiOperation({ summary: 'List refund policies (환불정책 목록)' })
  async listRefundPolicies(@CurrentUser() user: { academyId: number }) {
    return this.manageRefundPolicy.listPolicies(user.academyId);
  }

  @Get('refund-policies/:id')
  @ApiOperation({ summary: 'Get refund policy detail (환불정책 상세)' })
  async getRefundPolicy(@Param('id', ParseIntPipe) id: number) {
    const policy = await this.manageRefundPolicy.getPolicy(id);
    if (!policy) {
      throw new NotFoundException('Refund policy not found');
    }
    return policy;
  }

  @Post('refund-policies')
  @ApiOperation({ summary: 'Create new refund policy version (환불정책 신규 버전)' })
  async createRefundPolicy(
    @CurrentUser() user: { academyId: number; userId: number },
    @Body() dto: CreateRefundPolicyDto,
  ) {
    return this.manageRefundPolicy.createPolicy(user.academyId, dto, user.userId);
  }

  // --- Receipt Endpoints ---

  @Get('receipts')
  @ApiOperation({ summary: 'List receipts (영수증 목록)' })
  async listReceipts(@CurrentUser() user: { academyId: number }) {
    return this.getReceipts.execute(user.academyId);
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get receipt detail (영수증 상세)' })
  async getReceipt(@Param('id', ParseIntPipe) id: number) {
    const receipt = await this.getReceipts.executeById(id);
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    return receipt;
  }
}
