#frozen_string_literal: true
require 'rouge'

module Jekyll
  module CodeBlockFilter
    def highlight(input)
      return input unless input.is_a?(String)

      input.gsub(/<pre(?:\s+lang="([^"]*)")?><code>([^<]*)<\/code><\/pre>/) do
        lang = $1.to_s
        code = $2.gsub('&lt;', '<').gsub('&gt;', '>').gsub('&amp;', '&')
        
        lexer = Rouge::Lexer.find_fancy(lang, code) || Rouge::Lexers::PlainText
        highlighted = Rouge::Formatters::HTMLLegacy
          .new(line_numbers: false, wrap: false)
          .format(lexer.lex(code))

        <<~HTML
          <div class="message is-primary">
            <div class="message-header">
              <span class="sw sw-code is-capitalized">&nbsp;#{display_name(lang)}</span>
              <span class="sw sw-document copy-code is-hidden"></span>
            </div>
            <div>
              <pre class="highlight"><code>#{highlighted}</code></pre>
            </div>
          </div>
        HTML
      end
    end

    private

    def display_name(lang)
      return "Code" if lang.nil? || lang.empty?
      
      case lang.downcase
      when 'asm' then 'Assembly'
      when 'cpp', 'c++', 'cxx' then 'C++'
      when 'cuda' then 'CUDA C++'
      when 'cs', 'csharp' then 'C#'
      when 'fs', 'fsharp' then 'F#'
      when 'js', 'javascript' then 'JavaScript'
      when 'ts', 'typescript' then 'TypeScript'
      when 'plaintext' then 'Text'
      when 'powershell' then 'PowerShell'
      when 'rs', 'rust' then 'Rust'
      when 'rb', 'ruby' then 'Ruby'
      when 'vb', 'visualbasic' then 'VisualBasic'
      when 'py', 'python' then 'Python'
      when 'sh', 'bash', 'shell' then 'Shell'
      when 'html' then 'HTML'
      when 'css' then 'CSS'
      when 'scss', 'sass' then 'SCSS'
      when 'json' then 'JSON'
      when 'yaml', 'yml' then 'YAML'
      when 'xml' then 'XML'
      when 'sql' then 'SQL'
      else lang.upcase
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::CodeBlockFilter)