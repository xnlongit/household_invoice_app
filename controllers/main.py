import json
import logging
from datetime import date

from odoo import http
from odoo.exceptions import AccessDenied
from odoo.http import request
from werkzeug.wrappers import Response

_logger = logging.getLogger(__name__)


def _json_resp(data, status=200):
    return Response(
        json.dumps(data, default=str),
        status=status,
        content_type='application/json',
        headers={'Cache-Control': 'no-cache, no-store, must-revalidate'},
    )


def _require_session():
    if not request.session.uid:
        return _json_resp({'error': 'Not authenticated', 'code': 401}, status=401)
    return None


def _invoice_status(inv):
    if inv.state == 'draft':
        return 'draft'
    if inv.payment_state in ('paid', 'in_payment'):
        return 'paid'
    if inv.invoice_date_due and inv.invoice_date_due < date.today():
        return 'overdue'
    if inv.state == 'posted':
        return 'pending'
    return inv.state


class HouseholdInvoiceApp(http.Controller):

    # ------------------------------------------------------------------
    # Page routes
    # ------------------------------------------------------------------

    @http.route('/app', type='http', auth='public', website=False)
    def app_index(self, **kw):
        if request.session.uid:
            return request.redirect('/app/dashboard')
        return request.redirect('/app/login')

    @http.route('/app/login', type='http', auth='public', website=False)
    def page_login(self, **kw):
        if request.session.uid:
            return request.redirect('/app/dashboard')
        return request.render('household_invoice_app.page_login', {})

    @http.route('/app/dashboard', type='http', auth='public', website=False)
    def page_dashboard(self, **kw):
        if not request.session.uid:
            return request.redirect('/app/login')
        user = request.env['res.users'].sudo().browse(request.session.uid)
        return request.render('household_invoice_app.page_dashboard', {
            'user_name': user.name,
        })

    @http.route('/app/invoices', type='http', auth='public', website=False)
    def page_invoices(self, **kw):
        if not request.session.uid:
            return request.redirect('/app/login')
        user = request.env['res.users'].sudo().browse(request.session.uid)
        return request.render('household_invoice_app.page_invoices', {
            'user_name': user.name,
        })

    @http.route('/app/invoices/new', type='http', auth='public', website=False)
    def page_create_invoice(self, **kw):
        if not request.session.uid:
            return request.redirect('/app/login')
        user = request.env['res.users'].sudo().browse(request.session.uid)
        retail_partner = request.env.ref(
            'household_invoice_app.partner_retail_customer', raise_if_not_found=False
        )
        retail_name = retail_partner.sudo().name if retail_partner else 'Khách bán lẻ'
        return request.render('household_invoice_app.page_create_invoice', {
            'user_name': user.name,
            'retail_partner_name': retail_name,
        })

    @http.route('/app/invoices/<int:invoice_id>', type='http', auth='public', website=False)
    def page_invoice_detail(self, invoice_id, **kw):
        if not request.session.uid:
            return request.redirect('/app/login')
        user = request.env['res.users'].sudo().browse(request.session.uid)
        return request.render('household_invoice_app.page_invoice_detail', {
            'user_name': user.name,
            'invoice_id': invoice_id,
        })

    @http.route('/app/products', type='http', auth='public', website=False)
    def page_products(self, **kw):
        if not request.session.uid:
            return request.redirect('/app/login')
        user = request.env['res.users'].sudo().browse(request.session.uid)
        return request.render('household_invoice_app.page_products', {
            'user_name': user.name,
        })

    @http.route('/app/logout', type='http', auth='public', website=False)
    def page_logout(self, **kw):
        request.session.logout()
        return request.redirect('/app/login')

    # ------------------------------------------------------------------
    # DEBUG — xoá sau khi fix xong
    # ------------------------------------------------------------------

    @http.route('/app/api/debug', type='http', auth='public', methods=['GET'], csrf=False, website=False)
    def api_debug(self, **kw):
        from odoo import tools as odoo_tools
        info = {
            'request.db': request.db,
            'request.session.db': request.session.db,
            'request.session.uid': request.session.uid,
            'odoo_config_db_name': odoo_tools.config.get('db_name'),
            'odoo_config_db_host': odoo_tools.config.get('db_host'),
            'session_dict': dict(request.session),
        }
        return _json_resp(info)

    # ------------------------------------------------------------------
    # API: Auth
    # ------------------------------------------------------------------

    @http.route('/app/api/login', type='http', auth='public', methods=['POST'], csrf=False, website=False)
    def api_login(self, **kw):
        # Parse JSON body
        try:
            raw = request.httprequest.data
            data = json.loads(raw) if raw else {}
        except (ValueError, TypeError):
            return _json_resp({'error': 'Invalid JSON body'}, status=400)

        login = (data.get('login') or '').strip()
        password = data.get('password') or ''
        if not login or not password:
            return _json_resp({'error': 'Email và mật khẩu không được để trống'}, status=400)

        # Resolve database — always prefer odoo config to avoid corrupted session.db
        from odoo import tools as odoo_tools
        db = odoo_tools.config.get('db_name') or request.db
        if not db:
            try:
                from odoo.service.db import list_dbs
                dbs = list_dbs()
                db = dbs[0] if dbs else None
            except Exception:
                pass
        if not db:
            _logger.error('household_invoice_app: cannot determine database name')
            return _json_resp({'error': 'Không xác định được database. Kiểm tra cấu hình Odoo.'}, status=500)

        # Ensure session has the correct DB set before authenticate
        request.session.db = db
        _logger.info('household_invoice_app: login attempt login=%s db=%s', login, db)

        # Odoo 18 signature: authenticate(dbname, credential_dict)
        credential = {'login': login, 'password': password, 'type': 'password'}
        try:
            request.session.authenticate(db, credential)
            uid = request.session.uid
            if uid:
                user = request.env['res.users'].sudo().browse(uid)
                _logger.info('household_invoice_app: login OK uid=%s name=%s', uid, user.name)
                return _json_resp({'success': True, 'user': {'id': uid, 'name': user.name}})
            return _json_resp({'error': 'Email hoặc mật khẩu không đúng'}, status=401)

        except AccessDenied:
            _logger.info('household_invoice_app: AccessDenied for login=%s', login)
            return _json_resp({'error': 'Email hoặc mật khẩu không đúng'}, status=401)

        except Exception as e:
            _logger.exception('household_invoice_app: unexpected login error')
            return _json_resp({'error': 'Lỗi hệ thống: ' + str(e)}, status=500)

    # ------------------------------------------------------------------
    # API: Dashboard
    # ------------------------------------------------------------------

    @http.route('/app/api/dashboard', type='http', auth='public', methods=['GET'], website=False)
    def api_dashboard(self, **kw):
        err = _require_session()
        if err:
            return err

        env = request.env
        Move = env['account.move'].sudo()

        total_revenue = sum(Move.search([
            ('move_type', '=', 'out_invoice'),
            ('state', '=', 'posted'),
        ]).mapped('amount_total'))

        product_count = env['product.template'].sudo().search_count([
            ('sale_ok', '=', True),
        ])

        draft_count = Move.search_count([
            ('move_type', '=', 'out_invoice'),
            ('state', '=', 'draft'),
        ])

        recent = Move.search([('move_type', '=', 'out_invoice')],
                             limit=10, order='create_date desc, id desc')
        recent_data = [{
            'id': inv.id,
            'name': inv.name,
            'partner_name': inv.customer_name or inv.partner_id.name or 'Unknown',
            'invoice_date': inv.invoice_date.strftime('%b %d, %Y') if inv.invoice_date else '',
            'amount_total': inv.amount_total,
            'currency_symbol': inv.currency_id.symbol or '$',
            'status': _invoice_status(inv),
        } for inv in recent]

        return _json_resp({
            'total_revenue': total_revenue,
            'product_count': product_count,
            'draft_count': draft_count,
            'recent_invoices': recent_data,
        })

    # ------------------------------------------------------------------
    # API: Invoices
    # ------------------------------------------------------------------

    @http.route('/app/api/invoices', type='http', auth='public', methods=['GET'], website=False)
    def api_invoices_list(self, status='all', page=1, limit=20, **kw):
        err = _require_session()
        if err:
            return err

        page = max(1, int(page))
        limit = max(1, min(100, int(limit)))
        offset = (page - 1) * limit

        domain = [('move_type', '=', 'out_invoice')]
        if status == 'paid':
            domain.append(('payment_state', 'in', ['paid', 'in_payment']))
        elif status == 'overdue':
            domain += [('state', '=', 'posted'),
                       ('payment_state', 'not in', ['paid', 'reversed', 'in_payment']),
                       ('invoice_date_due', '<', date.today().isoformat())]
        elif status == 'pending':
            domain += [('state', '=', 'posted'),
                       ('payment_state', 'not in', ['paid', 'reversed'])]
        elif status == 'draft':
            domain.append(('state', '=', 'draft'))

        Move = request.env['account.move'].sudo()
        total = Move.search_count(domain)
        invoices = Move.search(domain, limit=limit, offset=offset,
                               order='create_date desc, id desc')

        data = [{
            'id': inv.id,
            'name': inv.name,
            'partner_name': inv.customer_name or inv.partner_id.name or 'Unknown',
            'partner_email': inv.partner_id.email or '',
            'invoice_date': inv.invoice_date.strftime('%b %d, %Y') if inv.invoice_date else '',
            'amount_total': inv.amount_total,
            'currency_symbol': inv.currency_id.symbol or '$',
            'status': _invoice_status(inv),
        } for inv in invoices]

        return _json_resp({
            'data': data,
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': max(1, (total + limit - 1) // limit),
        })

    @http.route('/app/api/invoices/<int:invoice_id>', type='http', auth='public', methods=['GET'], website=False)
    def api_invoice_detail(self, invoice_id, **_kw):
        err = _require_session()
        if err:
            return err
        inv = request.env['account.move'].sudo().browse(invoice_id)
        if not inv.exists() or inv.move_type != 'out_invoice':
            return _json_resp({'error': 'Không tìm thấy hóa đơn'}, status=404)
        lines = []
        for line in inv.invoice_line_ids:
            lines.append({
                'id': line.id,
                'description': line.name or '',
                'quantity': line.quantity,
                'price_unit': line.price_unit,
                'price_subtotal': line.price_subtotal,
                'taxes': [{'id': t.id, 'name': t.name, 'amount': t.amount} for t in line.tax_ids],
            })
        return _json_resp({
            'id': inv.id,
            'name': inv.name,
            'customer_name':    inv.customer_name or inv.partner_id.name or '',
            'customer_address': inv.customer_address or '',
            'customer_phone':   inv.customer_phone or '',
            'customer_note':    inv.customer_note or '',
            'invoice_date': inv.invoice_date.strftime('%d/%m/%Y') if inv.invoice_date else '',
            'status': _invoice_status(inv),
            'amount_untaxed': inv.amount_untaxed,
            'amount_tax': inv.amount_tax,
            'amount_total': inv.amount_total,
            'lines': lines,
        })

    @http.route('/app/api/invoices/create', type='http', auth='public', methods=['POST'],
                csrf=False, website=False)
    def api_invoices_create(self, **kw):
        err = _require_session()
        if err:
            return err
        try:
            data = json.loads(request.httprequest.data or b'{}')
            customer_name    = (data.get('customer_name') or '').strip()
            customer_address = (data.get('customer_address') or '').strip()
            customer_phone   = (data.get('customer_phone') or '').strip()
            customer_note    = (data.get('customer_note') or '').strip()
            invoice_date = (data.get('invoice_date') or '').strip() or date.today().isoformat()
            lines = data.get('lines') or []

            if not lines:
                return _json_resp({'error': 'Cần ít nhất một dòng sản phẩm'}, status=400)

            env = request.env

            # Luôn dùng partner "Khách bán lẻ" mặc định
            retail_partner = env.ref(
                'household_invoice_app.partner_retail_customer', raise_if_not_found=False
            )
            if not retail_partner:
                retail_partner = env['res.partner'].sudo().search(
                    [('name', '=', 'Khách bán lẻ')], limit=1
                )
            if not retail_partner:
                retail_partner = env['res.partner'].sudo().create(
                    {'name': 'Khách bán lẻ', 'customer_rank': 1}
                )

            invoice_lines = []
            for line in lines:
                vals = {
                    'name': line.get('description') or 'Service',
                    'quantity': float(line.get('quantity') or 1),
                    'price_unit': float(line.get('price_unit') or 0),
                }
                if line.get('product_id'):
                    vals['product_id'] = int(line['product_id'])
                if line.get('tax_ids'):
                    vals['tax_ids'] = [(6, 0, [int(tid) for tid in line['tax_ids']])]
                invoice_lines.append((0, 0, vals))

            invoice = env['account.move'].sudo().create({
                'move_type': 'out_invoice',
                'partner_id': retail_partner.id,
                'customer_name':    customer_name or False,
                'customer_address': customer_address or False,
                'customer_phone':   customer_phone or False,
                'customer_note':    customer_note or False,
                'invoice_date': invoice_date,
                'invoice_line_ids': invoice_lines,
            })
            return _json_resp({'success': True, 'invoice_id': invoice.id, 'name': invoice.name})
        except Exception:
            _logger.exception('Create invoice error')
            return _json_resp({'error': 'Không thể tạo hóa đơn'}, status=500)

    @http.route('/app/api/invoices/<int:invoice_id>/delete', type='http', auth='public',
                methods=['POST'], csrf=False, website=False)
    def api_invoice_delete(self, invoice_id, **_kw):
        err = _require_session()
        if err:
            return err
        inv = request.env['account.move'].sudo().browse(invoice_id)
        if not inv.exists() or inv.move_type != 'out_invoice':
            return _json_resp({'error': 'Không tìm thấy hóa đơn'}, status=404)
        if inv.state != 'draft':
            return _json_resp({'error': 'Chỉ xóa được hóa đơn ở trạng thái nháp'}, status=400)
        inv.unlink()
        return _json_resp({'success': True})

    # ------------------------------------------------------------------
    # API: Products
    # ------------------------------------------------------------------

    @http.route('/app/api/taxes', type='http', auth='public', methods=['GET'], website=False)
    def api_taxes(self, search='', **kw):
        err = _require_session()
        if err:
            return err

        domain = [('type_tax_use', 'in', ['sale', 'all']), ('active', '=', True)]
        if search:
            domain.append(('name', 'ilike', search))

        taxes = request.env['account.tax'].sudo().search(domain, limit=50, order='name asc')

        return _json_resp({
            'data': [{'id': t.id, 'name': t.name, 'amount': t.amount} for t in taxes],
        })

    # ------------------------------------------------------------------

    @http.route('/app/api/products', type='http', auth='public', methods=['GET'], website=False)
    def api_products(self, page=1, limit=20, search='', **kw):
        err = _require_session()
        if err:
            return err

        page = max(1, int(page))
        limit = max(1, min(100, int(limit)))
        offset = (page - 1) * limit

        domain = [('sale_ok', '=', True)]
        if search:
            domain.append(('name', 'ilike', search))

        Tmpl = request.env['product.template'].sudo()
        total = Tmpl.search_count(domain)
        products = Tmpl.search(domain, limit=limit, offset=offset, order='name asc')

        data = []
        for p in products:
            data.append({
                'id': p.id,
                'name': p.name,
                'list_price': p.list_price,
                'default_code': p.default_code or '',
                'categ_name': p.categ_id.name if p.categ_id else '',
                'uom_name': p.uom_id.name if p.uom_id else '',
                'taxes': [{'id': t.id, 'name': t.name, 'amount': t.amount} for t in p.taxes_id],
            })

        return _json_resp({
            'data': data,
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': max(1, (total + limit - 1) // limit),
        })
