# frozen_string_literal: true

begin
  require 'commonmarker'
  require 'rouge'
rescue LoadError => e
  Jekyll.logger.error "CommonMark:", "Please install dependencies: gem install commonmarker rouge"
  raise e
end

module Jekyll
  module Converters
    class Markdown
      class CommonMark
        DEFAULT_EXTENSIONS = [:table, :strikethrough, :autolink, :tagfilter].freeze
        
        def initialize(config)
          @config = config['commonmark'] || {}
          @extensions = extract_extensions
          @parse_opts = extract_options(:parse)
          @render_opts = extract_options(:render)
        end

        def convert(content)
          doc = CommonMarker.render_doc(content, @parse_opts, @extensions)
          HtmlRenderer.new(options: @render_opts, extensions: @extensions).render(doc)
        end

        private

        def extract_extensions
          exts = @config['extensions'] || []
          return DEFAULT_EXTENSIONS if exts.empty?
          
          valid = CommonMarker.extensions.map(&:to_sym)
          exts.map(&:to_sym).select { |e| valid.include?(e) || warn_invalid(e, "extension") }
        end

        def extract_options(type)
          opts = (@config['options'] || []).map { |o| o.upcase.to_sym }
          valid = CommonMarker::Config::OPTS[type].keys
          (opts & valid).tap { |res| return [:DEFAULT] if res.empty? }
        end

        def warn_invalid(item, type)
          Jekyll.logger.warn "CommonMark:", "#{item} is not a valid#{type}"
        end
      end

      class HtmlRenderer < CommonMarker::HtmlRenderer
        def code_block(node)
          lang = node.fence_info.to_s.split(/\s+/).first
          language_display = display_name(lang)
          
          code = rouge_highlight(node.string_content, lang)
          
          out(%Q{<div class="message is-primary">})
          out(%Q{<div class="message-header">})
          out(%Q{<span class="sw sw-code is-capitalized" aria-hidden="true"> #{language_display}</span>})
          out(%Q{<span class="sw sw-document copy-code is-hidden"></span>})
          out(%Q{</div>})
          out(%Q{<div>})
          out(%Q{<pre class="highlight"><code>#{code}</code></pre>})
          out(%Q{</div>})
          out(%Q{</div>})
        end

        private

        def display_name(language)
          return "Code" if language.nil? || language.empty?
          
          language = language.downcase
          case language
          when 'asm'
            'Assembly'
          when 'cpp', 'c++', 'cxx'
            'C++'
          when 'cuda'
            'CUDA C++'
          when 'csharp', 'cs'
            'C#'
          when 'fsharp'
            'F#'
          when 'javascript', 'js'
            'JavaScript'
          when 'plaintext'
            'Text'
          when 'powershell'
            'PowerShell'
          when 'rs', 'rust'
            'Rust'
          when 'ruby'
            'Ruby'
          when 'ts', 'typescript'
            'TypeScript'
          when 'vb', 'visualbasic'
            'VisualBasic'
          else
            language.upcase
          end
        end

        def rouge_highlight(code, lang)
          lexer = Rouge::Lexer.find_fancy(lang, code) || Rouge::Lexers::PlainText
          formatter = Rouge::Formatters::HTMLLegacy.new(line_numbers: false, wrap: false)
          formatter.format(lexer.lex(code))
        end
      end
    end
  end
end