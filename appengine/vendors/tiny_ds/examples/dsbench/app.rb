require 'sinatra'
require 'lib/tiny_ds'
require 'json'
require 'yaml'
require 'appengine-apis/memcache'
require 'appengine-apis/logger'

$gae_guid = "GAE"+Time.now.strftime("%Y%m%d%H%M%S")+"-"+java.util.UUID.randomUUID().to_s
$app_logger = AppEngine::Logger.new
def _log(s)
  if $env=="production"
    $app_logger.debug(s)
  elsif $env=="development"
    puts(s)
  end
end

# Make sure our template can use <%=h
helpers do
  include Rack::Utils
  alias_method :h, :escape_html
end

require "log_delegate"
LogDelegate.install
LogDelegate.logger = $app_logger
LogDelegate.environment = $env

before do
  #_log("#{Time.now.strftime('%Y%m%d_%H%M%S_%Z')},#{$gae_instance_guid}")
  LogDelegate.enable = (params[:ld]!="f")
end

class DummyEG < TinyDS::Base
end

class ManyPropertyKind
  def self.kind_name(count, type, index)
    name = "ManyProperty#{count}_#{type}"
    unless index
      name += "_NoIndex"
    end
    name
  end
  def self.define_class(count, type, index)
    name = kind_name(count, type, index)
    s = ""
    s << "class #{name} < TinyDS::Base\n"
    count.times do |i|
      s << "  property :prop_#{type}_#{i}, :#{type}, :index=>#{index}\n"
    end
    s << "end"
    eval(s, TOPLEVEL_BINDING)
  end
end

[1,2,4,8,16,32,64,128].each do |n|
  ManyPropertyKind.define_class(n, :integer, true)
  ManyPropertyKind.define_class(n, :integer, false)
  ManyPropertyKind.define_class(n, :string,  true)
  ManyPropertyKind.define_class(n, :string,  false)
end

get '/' do
  paths = []
  paths << "/01props_put?count=8&type=integer&index=true&repeat=10"
  paths << "/01props_put?count=32&type=integer&index=true&repeat=10"
  paths << "/01props_put?count=128&type=integer&index=true&repeat=10"
  paths << "/01props_put?count=8&type=integer&index=false&repeat=10"
  paths << "/01props_put?count=32&type=integer&index=false&repeat=10"
  paths << "/01props_put?count=128&type=integer&index=false&repeat=10"
  
  paths << "/11pbsize_put?size=1&repeat=5"
  paths << "/11pbsize_put?size=10000&repeat=5"
  paths << "/11pbsize_put?size=100000&repeat=5"
  paths << "/11pbsize_put?size=1000000&repeat=5"
  
  paths << "/21list_put?size=8&index=true&repeat=5"
  paths << "/21list_put?size=32&index=true&repeat=5"
  paths << "/21list_put?size=128&index=true&repeat=5"
  paths << "/21list_put?size=8&index=false&repeat=5"
  paths << "/21list_put?size=32&index=false&repeat=5"
  paths << "/21list_put?size=128&index=false&repeat=5"
  
  paths << "/31_basetx"

  html = paths.collect{|path| "<a href='#{path}'>#{h(path)}</a><br />" }.join
  html << "<hr />"
  html << "ENV['RACK_ENV']=[#{ENV['RACK_ENV']}] $env=[#{$env}]"
  html
end

get '/00warmup' do
  sleep_sec = (params[:sleep_sec] || 0).to_f
  if 0<sleep_sec
    sleep(sleep_sec)
  end
  "#{$gae_instance_guid} #{Time.now} sleep_sec=#{sleep_sec}"
end

# [01props_put] count of property, indexed or not
get '/01props_put' do
  count  = params[:count].to_i        # 1,2,4,8,16,32,64,128
  type   = params[:type].to_sym       # integer/string
  index  = (params[:index] =~/^t/)==0 # true/false
  repeat = params[:repeat].to_i       #
  txn    = (params[:txn]   =~/^t/)==0 # true/false
  batch  = (params[:batch] =~/^t/)==0 # true/false

  klass_name = ManyPropertyKind.kind_name(count, type, index)
  klass = eval(klass_name)

  parent_key = nil
  if txn && batch
    parent_key = DummyEG.build_key("#{Time.now}_#{rand}", nil)
  end

  bench_result = ds_benchmark do
    entities = []
    repeat.times do |repeat_count|
      e = klass.new({}, :parent=>parent_key)
      count.times do |i|
        e.send("prop_#{type}_#{i}=", rand(10000))
      end
      unless batch
        with_txn(txn){
          e.save
        }
      else
        entities << e
      end
    end
    if batch
      with_txn(txn){
        TinyDS.batch_save(entities)
      }
    end
  end

  pars = {:count=>count, :type=>type, :index=>index, :repeat=>repeat, :txn=>txn, :batch=>batch}

  content_type "text/plain"
  return render_result(
    :pars          => pars,
    :bench_result  => bench_result
  )
end


class LargeProperty < TinyDS::Base
  property :prop0, :text, :index=>false
end

# [11pbsize_put] size of PB. index=false.
get '/11pbsize_put' do
  size   = params[:size].to_i      # 1,1000,10000,100000,...
  repeat = params[:repeat].to_i    # 

  bench_result = ds_benchmark do
    repeat.times do |repeat_count|
      e = LargeProperty.create(:prop0=>"a"*size)
    end
  end

  pars = {:size=>size, :repeat=>repeat}

  content_type "text/plain"
  return render_result(
    :pars          => pars,
    :bench_result  => bench_result
  )
end

class ManyItemsListProperty < TinyDS::Base
  property :prop0, :list, :index=>true
end
class ManyItemsListPropertyNoIndex < TinyDS::Base
  property :prop0, :list, :index=>false
end

# [21list_put] list size. index=true/false.
get '/21list_put' do
  size   = params[:size].to_i      # 1,1000,10000,100000,...
  index  = params[:index]=="true"  # true/false
  repeat = params[:repeat].to_i    #

  klass = index ? ManyItemsListProperty : ManyItemsListPropertyNoIndex

  bench_result = ds_benchmark do
    repeat.times do |repeat_count|
      prop0 = (0...size).to_a.collect{ rand(10000000) }
      e = klass.create(:prop0=>prop0)
    end
  end

  pars = {:size=>size, :index=>index, :repeat=>repeat}

  content_type "text/plain"
  return render_result(
    :pars          => pars,
    :bench_result  => bench_result
  )
end


# [31_basetx]
class User < TinyDS::Base
  property :nickname,   :string
  property :money,      :integer
  property :sent_count, :integer, :default=>0
  property :recv_count, :integer, :default=>0
  def send_money_to(u2, amount)
    src_journal = nil
    TinyDS.tx do
      u1 = User.get(self.key)
      u1.money -= amount
      u1.sent_count += 1
      src_journal = TinyDS::BaseTx.build_journal(u1, u2, :apply_recv_money_from, u1.key.to_s, amount)
      TinyDS.batch_save([u1, src_journal])
    end
    src_journal.key
  end
  def apply_recv_money_from(u1_key, amount)
    self.money += amount
    self.recv_count += 1
    [self]
  end
end

get "/31_basetx" do
  _log "======== /31_basetx"
  @users = User.query.all
  erb <<END
User.count = #{User.count}<br />
<a href="/31_basetx/init?num=0">init(0)</a><br />
<a href="/31_basetx/init?num=5">init(5)</a><br />
<a href="/31_basetx/init?num=10">init(10)</a><br />
<a href="/31_basetx/init?num=20">init(20)</a><br />
<a href="/31_basetx/exec?apply=t&ld=t">exec(apply=t&ld=t)</a><br />
<a href="/31_basetx/exec?apply=f&ld=t">exec(apply=f&ld=t)</a><br />
<a href="/31_basetx/exec?apply=t&ld=f">exec(apply=t&ld=f)</a><br />
<a href="/31_basetx/exec?apply=f&ld=f">exec(apply=f&ld=f)</a><br />
<a href="/31_basetx/rollforward">rollforward</a><br />
<table border=1>
  <% @users.each_with_index do |u,num| %>
    <tr>
      <td>id=<%= h u.id      %></td>
      <td><%= h u.nickname   %></td>
      <td><%= h u.money      %></td>
      <td><%= h u.sent_count %></td>
      <td><%= h u.recv_count %></td>
    </tr>
  <% end %>
  <tr>
    <td>sum</td>
    <td>----</td>
    <td><%= h @users.inject(0){|sum,u| sum + u.money      } %></td>
    <td><%= h @users.inject(0){|sum,u| sum + u.sent_count } %></td>
    <td><%= h @users.inject(0){|sum,u| sum + u.recv_count } %></td>
  </tr>
</table>
<br />
SrcJournal.count=<%= TinyDS::BaseTx::SrcJournal.query.count3 %><br />
DestJournal.count=<%= TinyDS::BaseTx::DestJournal.query.count3 %><br />
END
end

get "/31_basetx/init" do
  _log "======== /31_basetx/init"
  [User, TinyDS::BaseTx::SrcJournal, TinyDS::BaseTx::DestJournal].each do |klass|
    klass.destroy_all
    raise "#{klass.name}.count!=0" if klass.count!=0
  end
  params[:num].to_i.times do |n|
    User.create({:nickname=>"u#{n+1}", :money=>10000}, :id=>n+1)
  end
  redirect "/31_basetx"
end

get "/31_basetx/exec" do
  if params[:count].nil?
    redirect "/31_basetx/exec?apply=#{params[:apply]}&ld=#{params[:ld]}&count=#{User.count}"
    return
  end
  _log "======== /31_basetx/exec"
  count = params[:count].to_i
  u1,u2 = User.get_by_ids([rand(count)+1, rand(count)+1])
  _log "    ==== send_money_to"
  src_journal_key = u1.send_money_to(u2, 100)
  if params[:apply]=="t"
    _log "    ==== apply"
    TinyDS::BaseTx.apply(src_journal_key)
  end
  redirect "/31_basetx"
end

get "/31_basetx/rollforward" do
  _log "======== /31_basetx/rollforward"
  TinyDS::BaseTx.apply_pendings
  redirect "/31_basetx"
end



# TODO
# - 「tx内でJournalをbatch_put * 10」「エンティティ内にYAMLでジャーナル」
# - query(普通にquery, keyonly, count)
#   query(result-count,key-only,limit,offset,ancestor,count)
# - put api_cpu_ms with composite index(one,many...)
# - batch_get vs get
# - memcache(PB-size)
# - key range query
# - "keyonly-query+batch_get" vs "query"

$qs = com.google.appengine.api.quota.QuotaServiceFactory.getQuotaService
def ds_benchmark
  bench_result = {}
  rpc_calls = LogDelegate.instance.collect_logs do
    begin_api_cycles = $qs.getApiTimeInMegaCycles
    begin_cpu_cycles = $qs.getCpuTimeInMegaCycles
    begin_ns         = java.lang.System.nanoTime
    yield
    end_ns           = java.lang.System.nanoTime
    end_cpu_cycles   = $qs.getCpuTimeInMegaCycles
    end_api_cycles   = $qs.getApiTimeInMegaCycles

    bench_result[:api_ms]  = $qs.convertMegacyclesToCpuSeconds(end_api_cycles - begin_api_cycles)*1000
    bench_result[:cpu_ms]  = $qs.convertMegacyclesToCpuSeconds(end_cpu_cycles - begin_cpu_cycles)/1000.0
    bench_result[:real_ms] = (end_ns - begin_ns)/1000000.0
  end
  bench_result.merge!(rpc_calls_sum_and_avg(rpc_calls))
  bench_result[:rpc_calls] = rpc_calls
  return bench_result
end

def rpc_calls_sum_and_avg(rpc_calls)
  rpc_calls_sum = {}
  rpc_calls_avg = {}
  [:api_ms, :cpu_ms, :real_ms, :req_size, :resp_size].each do |k|
    rpc_calls_sum[k] = rpc_calls.inject(0){|sum,a| sum+=a[k] }
    rpc_calls_avg[k] = rpc_calls_sum[k]/rpc_calls.size
  end
  return {:rpc_calls_count=>rpc_calls.size,
          :rpc_calls_sum=>rpc_calls_sum,
          :rpc_calls_avg=>rpc_calls_avg}
end

def with_txn(txn)
  if txn
    TinyDS.tx{ yield }
  else
    yield
  end
end

def __current_quotas
  qs = com.google.appengine.api.quota.QuotaServiceFactory.getQuotaService
  cpu_cycles   = qs.getCpuTimeInMegaCycles
  cpu_sec      = qs.convertMegacyclesToCpuSeconds(cpu_cycles)
  cpu_supports = qs.supports(com.google.appengine.api.quota.QuotaService::DataType::CPU_TIME_IN_MEGACYCLES)
  api_cycles   = qs.getApiTimeInMegaCycles
  api_sec      = qs.convertMegacyclesToCpuSeconds(api_cycles)
  api_supports = qs.supports(com.google.appengine.api.quota.QuotaService::DataType::API_TIME_IN_MEGACYCLES)
  return {:cpu=>{:cycles=>cpu_cycles, :sec=>cpu_sec, :supports=>cpu_supports},
          :api=>{:cycles=>api_cycles, :sec=>api_sec, :supports=>api_supports}}
end

def render_result(hash)
  hash[:now]      = Time.now.strftime("%Y%m%d_%H%M%S_%Z")
  hash[:gae_guid] = $gae_guid
  hash.to_yaml
end

=begin
$mc     = AppEngine::Memcache.new
$mc.delete(counter_name)
count = $mc.incr(counter_name)
$mc.set(counter_name, count)
prev_t = $mc.get("global_timestamp")
# appcfg.rb --severity=0 request_logs . gae.log
# cat gae.log | ruby -e 'STDIN.each_char{|c| print(c=="\000" ? "\n" : c) }' | grep GAE | less
=end
