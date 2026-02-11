# frozen_string_literal: true
require 'commonmarker'

module Jekyll
  module Converters
    class Markdown
      class CommonMark
        def initialize(config)
          @config = (config['commonmark'] || {}).transform_values { |v| v.transform_keys(&:to_sym) }
        end

        def convert(content)
          html = Commonmarker.to_html(
            content,
            options: {
              parse: @config['parse'] || {},
              render: @config['render'] || {},
              extension: @config['extension'] || {}
            },
            plugins: { syntax_highlighter: nil }
          )
        end
      end
    end
  end
end
