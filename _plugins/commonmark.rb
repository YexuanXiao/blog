# frozen_string_literal: true
require 'commonmarker'

module Jekyll
  module Converters
    class Markdown
      class CommonMark
        def initialize(config)
          @config = config['commonmark'] || {}
        end

        def convert(content)
          html = Commonmarker.to_html(
            content,
            options: {
              parse: @config.dig('options', 'parse') || {},
              render: @config.dig('options', 'render') || {},
              extension: @config['extensions'] || {}
            },
            plugins: { syntax_highlighter: nil }
          )
        end
      end
    end
  end
end