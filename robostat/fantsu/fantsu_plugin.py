import flask

class Fantsu:

    def __init__(self, app, host, port):
        bp = flask.Blueprint("fantsu", __name__,
                static_folder="static",
                static_url_path="/static/fantsu"
        )
        app.register_blueprint(bp)
        app.context_processor(self._inject_context)
        self.host = host
        self.port = port

    def _inject_context(self):
        return { "fantsu": self }

    def inject_component(self, id="fantsu-control"):
        return f"<div id='{id}' style='margin: 40px 0'></div>"

    def inject_scripts(self, call, event_id, component_id="fantsu-control", connect=10):
        url = flask.url_for("fantsu.static", filename="fantsu.min.js")
        return f"""
            <script src="{url}"></script>
            <script type="text/javascript">
                {call}(
                    "#{component_id}",
                    {{ 
                        server: "{self.host}",
                        port: {self.port},
                        event: {event_id},
                        connect: {connect}
                    }}
                );
            </script>
        """
