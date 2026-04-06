from odoo import models, fields, api


def _amount_to_words_vi(amount):
    """Convert a number to Vietnamese words. Example: 138000 -> 'Một trăm ba mươi tám nghìn đồng'."""
    if amount == 0:
        return 'Không đồng'

    amount = int(round(amount))

    ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
    ones_cap = ['', 'Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín']

    def read_below_1000(n, is_leading=False):
        """Convert number 0-999 to Vietnamese words."""
        if n == 0:
            return ''

        result = ''
        hundreds = n // 100
        tens = (n % 100) // 10
        unit = n % 10

        if hundreds > 0:
            result += ones[hundreds] + ' trăm'
            if tens == 0 and unit > 0:
                result += ' linh ' + ones[unit]
            elif tens > 0:
                result += ' ' + read_tens(tens, unit)
        else:
            if not is_leading:
                if tens == 0 and unit > 0:
                    result += 'linh ' + ones[unit]
                elif tens > 0:
                    result += read_tens(tens, unit)
            else:
                if tens > 0:
                    result += read_tens(tens, unit)
                elif unit > 0:
                    result += ones[unit]

        return result.strip()

    def read_tens(tens, unit):
        """Convert tens + unit to Vietnamese words."""
        result = ''
        if tens == 1:
            result = 'mười'
            if unit == 0:
                pass
            elif unit == 5:
                result += ' lăm'
            else:
                result += ' ' + ones[unit]
        else:
            result = ones[tens] + ' mươi'
            if unit == 0:
                pass
            elif unit == 1:
                result += ' mốt'
            elif unit == 5:
                result += ' lăm'
            else:
                result += ' ' + ones[unit]
        return result

    # Split into groups: ty (billion), trieu (million), nghin (thousand), remainder
    ty = amount // 1_000_000_000
    remainder = amount % 1_000_000_000
    trieu = remainder // 1_000_000
    remainder = remainder % 1_000_000
    nghin = remainder // 1_000
    donvi = remainder % 1_000

    parts = []

    if ty > 0:
        ty_words = read_below_1000(ty, is_leading=True)
        if ty_words:
            parts.append(ty_words.capitalize() + ' tỷ')

    if trieu > 0:
        trieu_words = read_below_1000(trieu, is_leading=(ty == 0))
        if trieu_words:
            if ty > 0:
                parts.append(trieu_words + ' triệu')
            else:
                parts.append(trieu_words.capitalize() + ' triệu')

    if nghin > 0:
        nghin_words = read_below_1000(nghin, is_leading=(ty == 0 and trieu == 0))
        if nghin_words:
            if ty > 0 or trieu > 0:
                parts.append(nghin_words + ' nghìn')
            else:
                parts.append(nghin_words.capitalize() + ' nghìn')

    if donvi > 0:
        donvi_words = read_below_1000(donvi, is_leading=(ty == 0 and trieu == 0 and nghin == 0))
        if donvi_words:
            if ty > 0 or trieu > 0 or nghin > 0:
                parts.append(donvi_words)
            else:
                parts.append(donvi_words.capitalize())

    if not parts:
        return 'Không đồng'

    result = ' '.join(parts)
    # Capitalize first letter
    result = result[0].upper() + result[1:] if result else result
    return result + ' đồng'


class HouseholdStoreConfig(models.Model):
    _name = 'household.store.config'
    _description = 'Cấu hình thông tin cửa hàng'
    _rec_name = 'store_name'

    store_name = fields.Char(string='Tên cửa hàng', required=True)
    specialty = fields.Char(string='Chuyên ngành')
    address = fields.Char(string='Địa chỉ')
    phone = fields.Char(string='Số điện thoại')
    bank_account = fields.Char(string='Số tài khoản')
    bank_name = fields.Char(string='Tên ngân hàng')
    bank_owner = fields.Char(string='Chủ tài khoản')
    qr_image = fields.Binary(string='Mã QR thanh toán', attachment=True)
    logo_image = fields.Binary(string='Logo cửa hàng', attachment=True)

    @api.model
    def get_config(cls):
        """Return the first store config record, or empty recordset."""
        return cls.search([], limit=1)
