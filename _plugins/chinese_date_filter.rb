module Jekyll
  module ChineseDateFilter
    def chinese_date(date)
      return '' if date.nil?
      date_obj = date.is_a?(String) ? Date.parse(date) : date.to_date
      "#{date_obj.year}年#{date_obj.month}月#{date_obj.day}日"
    end
  end
end

Liquid::Template.register_filter(Jekyll::ChineseDateFilter)