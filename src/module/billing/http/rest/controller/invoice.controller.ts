import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@sharedModules/auth/guard/auth.guard';
import { plainToInstance } from 'class-transformer';
import { InvoiceService } from '@billingModule/core/service/invoice.service';
import { InvoiceResponseDto } from '@billingModule/http/rest/dto/response/invoice-response.dto';

@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  async getUserInvoices(
    @Query('userId') userId: string,
  ): Promise<InvoiceResponseDto[]> {
    // TODO: Get userId from request context/auth token
    const actualUserId = userId || 'current-user-id';
    const invoices = await this.invoiceService.getUserInvoices(actualUserId);

    return invoices.map((invoice) =>
      plainToInstance(InvoiceResponseDto, invoice, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get(':id')
  async getInvoice(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ): Promise<InvoiceResponseDto> {
    // TODO: Get userId from request context/auth token
    const actualUserId = userId || 'current-user-id';
    const invoice = await this.invoiceService.getInvoiceById(id, actualUserId);

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return plainToInstance(InvoiceResponseDto, invoice, {
      excludeExtraneousValues: true,
    });
  }
}
