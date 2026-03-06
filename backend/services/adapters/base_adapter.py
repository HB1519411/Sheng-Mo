class BaseAdapter:
    def convert_payload(self, standard_payload):
        raise NotImplementedError
    def parse_response(self, response_json):
        raise NotImplementedError
    def get_headers(self, api_key):
        raise NotImplementedError
    def get_api_url(self, base_address, model, api_key):
        raise NotImplementedError