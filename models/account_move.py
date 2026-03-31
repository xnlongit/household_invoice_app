from odoo import models, fields


class AccountMove(models.Model):
    _inherit = 'account.move'

    customer_name = fields.Char(string='Tên khách hàng (bán lẻ)')
