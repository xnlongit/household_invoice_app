from odoo import models, fields, api
from .store_config import _amount_to_words_vi


class AccountMove(models.Model):
    _inherit = 'account.move'

    customer_name    = fields.Char(string='Tên khách hàng (bán lẻ)')
    customer_address = fields.Char(string='Địa chỉ khách hàng')
    customer_phone   = fields.Char(string='Số điện thoại khách hàng')
    customer_note    = fields.Char(string='Ghi chú khách hàng')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('move_type') == 'out_invoice' and not vals.get('name'):
                vals['name'] = (
                    self.env['ir.sequence'].next_by_code('household.invoice') or '/'
                )
        return super().create(vals_list)

    def _set_next_sequence(self):
        # Giữ nguyên tên HĐxxxxx đã gán lúc tạo draft, không để journal ghi đè
        for move in self:
            if move.move_type == 'out_invoice' and move.name and move.name.startswith('HĐ'):
                continue
            super(AccountMove, move)._set_next_sequence()

    def _amount_to_words(self):
        """Return amount_total in Vietnamese words."""
        self.ensure_one()
        return _amount_to_words_vi(self.amount_total)
